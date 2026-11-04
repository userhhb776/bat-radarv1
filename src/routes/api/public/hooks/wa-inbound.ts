import { createFileRoute } from "@tanstack/react-router";

// Recebe da Evolution API as mensagens que chegam. Se quem respondeu é uma empresa/contato abordado,
// cancela o resto do funil, marca "Respondeu" e avisa o usuário.
export const Route = createFileRoute("/api/public/hooks/wa-inbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { inboundToken, samePhone, isFromMeFlag } = await import("@/lib/wa-inbound.server");
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
          const fromMe = isFromMeFlag(k["fromMe"]);
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
            if (fromMe) {
              // mensagem que você mandou pelo celular: registra na conversa do agente e pausa a IA nesse contato
              // no número de teste do dono não registra pausa (senão o agente para de responder no teste)
              const ag = agents?.some((x) => x.training_phone && match(x.training_phone)) ? undefined : agents?.[0];
              if (text && ag) {
                const phone = phones[0]!;
                const since2 = new Date(Date.now() - 180000).toISOString();
                const { data: dup } = await supabaseAdmin.from("agent_messages").select("id").eq("agent_id", ag.id).eq("phone", phone).eq("direction", "out").eq("body", text.slice(0, 4000)).gte("created_at", since2).limit(1);
                if (!dup?.length) {
                  await supabaseAdmin.from("agent_messages").insert({ user_id: ag.user_id, agent_id: ag.id, phone, contact_name: "", direction: "out", body: text.slice(0, 4000), manual: true } as any);
                  await (supabaseAdmin as any).from("agent_pauses").upsert({ agent_id: ag.id, phone, user_id: ag.user_id });
                }
              }
              continue;
            }
            if (text && agents?.length) {
              const sb = supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient;
              const { evoSend } = await import("@/lib/evolution.server");
              const { agentOwnerChat } = await import("@/lib/agents.server");
              const key = (await (await import("@/lib/service-config.server")).getOllamaKey()) ?? "";
              const origin = new URL(request.url).origin;
              const phone = phones[0]!;
              const isOwner = (a: any) => a.training_phone && match(a.training_phone);
              // vários agentes treinando no mesmo número: fica com o que falou por último com você
              const trainers = agents.filter((a) => a.training_mode && isOwner(a));
              let trainer = trainers[0];
              if (trainers.length > 1) {
                const { data: last } = await sb.from("agent_messages").select("agent_id").in("agent_id", trainers.map((x) => x.id)).like("phone", `%${phone.replace(/\D/g, "").slice(-8)}`).order("created_at", { ascending: false }).limit(1);
                trainer = trainers.find((x) => x.id === (last as any)?.[0]?.agent_id) ?? trainer;
              }
              const boss = /^\s*\/dono\s?12\b/i.test(text) ? (trainer ?? agents.find(isOwner)) : undefined;
              if (boss) {
                const trainer = boss;
                // /dono12 = ordem do dono nos bastidores; sem o comando, o agente trata você como cliente (simulação)
                const order = text.replace(/^\s*\/dono\s?12\b/i, "").trim() || "Status rápido.";
                const tp = "treino:" + trainer.training_phone;
                const { data: past } = await sb.from("agent_messages").select("direction,body").eq("agent_id", trainer.id).eq("phone", tp).order("created_at", { ascending: false }).limit(16);
                const hist = (past ?? []).reverse().map((m: any) => ({ role: m.direction === "in" ? "user" : "assistant", content: m.body }));
                const { data: sim } = await sb.from("agent_messages").select("direction,body").eq("agent_id", trainer.id).eq("phone", phone).order("created_at", { ascending: false }).limit(12);
                const simTxt = (sim ?? []).reverse().map((m: any) => `${m.direction === "in" ? "Cliente(simulado)" : "Agente"}: ${m.body}`).join("\n");
                const full = `${order}\n\n(Conversa de simulação recente, para contexto:\n${simTxt || "nenhuma"})\nSe for uma correção de comportamento, grave com "aprender".`;
                await sb.from("agent_messages").insert({ user_id: trainer.user_id, agent_id: trainer.id, phone: tp, contact_name: "Treino (você)", direction: "in", body: order.slice(0, 4000) });
                const r = await agentOwnerChat(sb, trainer as any, key, [...hist, { role: "user", content: full }], origin);
                if (r.reply) {
                  await evoSend(instance, phone, ["🛠️ " + r.reply]);
                  await sb.from("agent_messages").insert({ user_id: trainer.user_id, agent_id: trainer.id, phone: tp, contact_name: "Treino (você)", direction: "out", body: r.reply.slice(0, 4000) });
                }
                continue;
              }
              if (trainer) {
                const { humanReply } = await import("@/lib/agents.server");
                // teste: nunca fica pausado no seu número e responde rápido (evita estourar o tempo do webhook)
                await (sb as any).from("agent_pauses").delete().eq("agent_id", trainer.id).eq("phone", phone);
                const providerMessageId = String(k["id"] ?? "").trim() || null;
                const { data: inb } = await sb.from("agent_messages").insert({ user_id: trainer.user_id, agent_id: trainer.id, phone, contact_name: "Simulação (você)", direction: "in", body: text.slice(0, 4000), provider_message_id: providerMessageId }).select("id").maybeSingle();
                // A Evolution pode reenviar o mesmo messages.upsert. Só a primeira entrega pode disparar a IA.
                if (!(inb as any)?.id) continue;
                const r: any = await humanReply(sb, { ...trainer, pace: "rapido", miner: { ...((trainer as any).miner ?? {}), md_teste: false } } as any, key, instance, phone, "Simulação", (inb as any).id);
                if (r?.hot && !r?.replies?.length && !r?.audioId) {
                  await notifyUser(
                    supabaseAdmin,
                    trainer.user_id,
                    `⚠️ ${trainer.name}: Assuma o controle`,
                    `Simulação disse: "${text.slice(0, 100)}". Nenhuma situação B-T6X cadastrada.`,
                    "/agentes"
                  ).catch(() => 0);
                }
                continue;
              }
              // Segurança: só responde a contatos que este agente realmente abordou.
              // A autorização vem de um envio registrado pelo agente ou de um lead próprio já abordado.
              // Falha fechada: se não houver prova de abordagem, nenhuma conversa/IA é iniciada.
              const tail = phone.replace(/\D/g, "").slice(-8);
              if (tail.length < 6) continue;
              const agentIds = agents.map((x) => x.id);
              const { data: outbound } = await sb.from("agent_messages")
                .select("agent_id,phone,created_at")
                .in("agent_id", agentIds)
                .eq("direction", "out")
                .like("phone", `%${tail}`)
                .order("created_at", { ascending: false })
                .limit(30);
              let authorizedAgentId = (outbound ?? []).find((m: any) => samePhone(String(m.phone ?? ""), phone))?.agent_id as string | undefined;
              if (!authorizedAgentId) {
                const { data: approached } = await sb.from("agent_leads")
                  .select("agent_id,phone,created_at")
                  .in("agent_id", agentIds)
                  .eq("status", "abordado")
                  .like("phone", `%${tail}`)
                  .order("created_at", { ascending: false })
                  .limit(30);
                authorizedAgentId = (approached ?? []).find((lead: any) => samePhone(String(lead.phone ?? ""), phone))?.agent_id as string | undefined;
              }
              const a = agents.find((x) => x.id === authorizedAgentId);
              if (a) {
                const name = String(it["pushName"] ?? "");
                // grava sempre a mensagem do cliente, mesmo com a IA desligada ou pausada
                const providerMessageId = String(k["id"] ?? "").trim() || null;
                const { data: inb } = await sb.from("agent_messages").insert({ user_id: a.user_id, agent_id: a.id, phone, contact_name: name, direction: "in", body: text.slice(0, 4000), provider_message_id: providerMessageId }).select("id").maybeSingle();
                // Idempotência: webhooks repetidos com o mesmo ID não criam novas respostas.
                if (!(inb as any)?.id) continue;
                if (!a.auto_reply) continue;
                const { humanReply } = await import("@/lib/agents.server");
                const r: any = await humanReply(sb, a as any, key, instance, phone, name, (inb as any).id);
                if (r.skipped === "fora_da_janela_15_min") {
                  await notifyUser(
                    supabaseAdmin,
                    a.user_id,
                    `⚠️ ${a.name}: Assuma o controle`,
                    `${name || phone} respondeu após mais de 15 min: "${text.slice(0, 100)}". Transferido para atendimento manual.`,
                    "/agentes"
                  ).catch(() => 0);
                  continue;
                }
                if (r.skipped) continue;
                if (r.hot && !r.replies?.length && !r.audioId) {
                  await notifyUser(
                    supabaseAdmin,
                    a.user_id,
                    `⚠️ ${a.name}: Assuma o controle`,
                    `${name || phone} disse: "${text.slice(0, 100)}". Nenhuma situação B-T6X cadastrada.`,
                    "/agentes"
                  ).catch(() => 0);
                } else if (r.hot) {
                  await notifyUser(supabaseAdmin, a.user_id, `🔥 ${a.name}: cliente quente`, `${name || phone}: ${r.reason || "quer avançar"}`, "/agentes").catch(() => 0);
                  if (a.training_phone && !match(a.training_phone) && !samePhone(phone, a.training_phone)) await evoSend(instance, a.training_phone, [`🔥 ${name || phone} (${phone}) está quente: ${r.reason}`]).catch(() => 0);
                }
              }
            }
          } catch (e) { console.error("agent", e); }
          if (fromMe) continue;

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
