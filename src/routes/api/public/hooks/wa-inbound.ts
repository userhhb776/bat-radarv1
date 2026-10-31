import { createFileRoute } from "@tanstack/react-router";

// Recebe da Evolution API as mensagens que chegam. Se quem respondeu é uma empresa/contato abordado,
// cancela o resto do funil, marca "Respondeu" e avisa o usuário.
export const Route = createFileRoute("/api/public/hooks/wa-inbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { inboundToken, samePhone } = await import("@/lib/wa-inbound.server");
        const t = new URL(request.url).searchParams.get("t") ?? "";
        if (!t || t !== inboundToken()) return new Response("denied", { status: 401 });
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body) return new Response("ok");
        const event = String(body["event"] ?? "").toLowerCase().replace("_", ".");
        if (event !== "messages.upsert") return new Response("ok");
        const instance = String(body["instance"] ?? "");
        const raw = body["data"];
        const items = (Array.isArray(raw) ? raw : [raw]) as Array<Record<string, unknown>>;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { notifyUser } = await import("@/lib/push.server");
        const pl = supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient;
        const since = new Date(Date.now() - 30 * 86400000).toISOString();
        for (const it of items) {
          const k = (it?.["key"] ?? {}) as Record<string, unknown>;
          if (k["fromMe"]) continue;
          const jids = [k["remoteJid"], k["remoteJidAlt"], k["senderPn"], k["participantAlt"]].map((j) => String(j ?? ""));
          if (jids.some((j) => j.endsWith("@g.us") || j.includes("broadcast"))) continue;
          const phones = jids.filter((j) => j.endsWith("@s.whatsapp.net")).map((j) => j.split("@")[0]!);
          if (!phones.length || !instance) continue;
          const match = (p: string) => phones.some((x) => samePhone(x, p));

          // Agentes: ordens do dono (modo treinamento) ou resposta automática ao cliente
          try {
            const msg = (it?.["message"] ?? {}) as Record<string, any>;
            const text = String(msg["conversation"] ?? msg["extendedTextMessage"]?.["text"] ?? "").trim();
            const { data: agents } = await supabaseAdmin.from("agents").select("*").eq("instance", instance).eq("active", true);
            if (text && agents?.length) {
              const sb = supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient;
              const { evoSend } = await import("@/lib/evolution.server");
              const { agentOwnerChat, agentClientReply } = await import("@/lib/agents.server");
              const key = (await (await import("@/lib/service-config.server")).getOllamaKey()) ?? "";
              const origin = new URL(request.url).origin;
              const phone = phones[0]!;
              const trainer = agents.find((a) => a.training_mode && a.training_phone && match(a.training_phone));
              if (trainer) {
                const r = await agentOwnerChat(sb, trainer as any, key, [{ role: "user", content: text }], origin);
                if (r.reply) await evoSend(instance, phone, [r.reply]);
                continue;
              }
              const a = agents.find((x) => x.auto_reply);
              if (a) {
                const name = String(it["pushName"] ?? "");
                await sb.from("agent_messages").insert({ user_id: a.user_id, agent_id: a.id, phone, contact_name: name, direction: "in", body: text.slice(0, 4000) });
                const r = await agentClientReply(sb, a as any, key, phone, name);
                if (r.reply) {
                  await evoSend(instance, phone, [r.reply]);
                  await sb.from("agent_messages").insert({ user_id: a.user_id, agent_id: a.id, phone, contact_name: name, direction: "out", body: r.reply, hot: r.hot });
                }
                if (r.hot) {
                  await notifyUser(supabaseAdmin, a.user_id, `🔥 ${a.name}: cliente quente`, `${name || phone}: ${r.reason || "quer avançar"}`, "/agentes").catch(() => 0);
                  if (a.training_phone) await evoSend(instance, a.training_phone, [`🔥 ${name || phone} (${phone}) está quente: ${r.reason}`]).catch(() => 0);
                }
              }
            }
          } catch (e) { console.error("agent", e); }

          // BatRadar (campanhas Google e agendamentos)
          const { data: rows } = await supabaseAdmin.from("wa_scheduled").select("id,user_id,lead_id,name,phone,status,campaign_id")
            .eq("instance", instance).in("status", ["pendente", "enviando", "enviada"]).gte("created_at", since);
          const mine = (rows ?? []).filter((r) => match(r.phone));
          const sent = mine.filter((r) => r.status === "enviada");
          if (sent.length) {
            const pend = mine.filter((r) => r.status === "pendente").map((r) => r.id);
            if (pend.length) await supabaseAdmin.from("wa_scheduled").update({ status: "cancelada", error: "Cliente respondeu — funil interrompido." }).in("id", pend).eq("status", "pendente");
            const r0 = sent[0]!;
            let changed = 0;
            for (const leadId of [...new Set(mine.map((r) => r.lead_id).filter(Boolean))] as string[]) {
              const { data: up } = await supabaseAdmin.from("leads").update({ status: "respondeu" }).eq("id", leadId).eq("user_id", r0.user_id).in("status", ["novo", "enviada"]).select("id");
              changed += up?.length ?? 0;
            }
            if (!mine.some((r) => r.lead_id)) {
              const { data: ls } = await supabaseAdmin.from("leads").select("id,phone,status").eq("user_id", r0.user_id).in("status", ["novo", "enviada"]);
              for (const l of (ls ?? []).filter((l) => l.phone && match(l.phone))) {
                await supabaseAdmin.from("leads").update({ status: "respondeu" }).eq("id", l.id);
                changed++;
              }
            }
            if (pend.length || changed) {
              await notifyUser(supabaseAdmin, r0.user_id, "💬 Cliente respondeu!", `${r0.name} respondeu sua mensagem. Abra o WhatsApp e responda.${pend.length ? " As próximas mensagens foram canceladas." : ""}`, "/crm").catch(() => 0);
            }
          }

          // Papa Lead (fila própria)
          const { data: plRows } = await pl.from("pl_queue").select("id,user_id,name,phone,status,replied,campaign_id")
            .in("status", ["pendente", "enviando", "enviada"]).gte("created_at", since);
          const plMine = ((plRows ?? []) as Array<Record<string, unknown>>).filter((r) => match(String(r["phone"])));
          if (plMine.length) {
            const camps = [...new Set(plMine.map((r) => String(r["campaign_id"])))];
            const { data: cs } = await pl.from("pl_campaigns").select("id").in("id", camps).eq("instance", instance);
            const ok = new Set(((cs ?? []) as Array<{ id: string }>).map((c) => c.id));
            const rel = plMine.filter((r) => ok.has(String(r["campaign_id"])));
            const plSent = rel.filter((r) => r["status"] === "enviada");
            if (plSent.length) {
              const fresh = plSent.filter((r) => !r["replied"]).map((r) => String(r["id"]));
              if (fresh.length) await pl.from("pl_queue").update({ replied: true }).in("id", fresh);
              const pend = rel.filter((r) => r["status"] === "pendente").map((r) => String(r["id"]));
              if (pend.length) await pl.from("pl_queue").update({ status: "cancelada", error: "Contato respondeu." }).in("id", pend).eq("status", "pendente");
              if (fresh.length || pend.length) {
                const r0 = plSent[0]!;
                await notifyUser(supabaseAdmin, String(r0["user_id"]), "💬 Contato respondeu!", `${String(r0["name"]) || "Um contato"} respondeu. Abra o WhatsApp e responda.`, "/papa-lead-campanhas").catch(() => 0);
              }
            }
          }
        }
        return new Response("ok");
      },
    },
  },
});
