import { createFileRoute } from "@tanstack/react-router";
import { cronDenied } from "@/lib/cron-guard.server";

export const Route = createFileRoute("/api/public/hooks/wa-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await cronDenied(request);
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { evoSend, evoLabel } = await import("@/lib/evolution.server");
        const { notifyUser } = await import("@/lib/push.server");
        // Ping independente da atividade; a frequência de 5 min fica no scheduler externo.
        try {
          const { pingEvolution } = await import("@/lib/evolution-http.server");
          if (!await pingEvolution()) console.warn("[Evolution keep-alive] servidor indisponível ou não configurado");
        } catch (error) {
          console.warn("[Evolution keep-alive] ping falhou:", error);
        }
        // envios que ficaram presos em "enviando" (servidor caiu no meio) voltam como falha para poder tentar de novo
        const stale = new Date(Date.now() - 15 * 60000).toISOString();
        await supabaseAdmin.from("wa_scheduled").update({ status: "falhou", error: "Envio interrompido; confira no WhatsApp e tente de novo." }).eq("status", "enviando").lt("send_at", stale);
        // limite alto: campanhas pausadas com muitos atrasados não podem "tampar" a fila das ativas
        const { data: dueAll } = await supabaseAdmin
          .from("wa_scheduled").select("*").eq("status", "pendente")
          .lte("send_at", new Date().toISOString()).order("send_at").limit(300);
        const campIds = [...new Set((dueAll ?? []).map((r) => r.campaign_id).filter(Boolean))] as string[];
        const paused = new Set<string>();
        const campGap = new Map<string, number>();
        let waRetryAt = 0;
        if (campIds.length) {
          const { data: cs } = await supabaseAdmin.from("campaigns").select("id,status,min_gap_s").in("id", campIds);
          for (const c of cs ?? []) { if (c.status !== "ativa") paused.add(c.id); campGap.set(c.id, Number(c.min_gap_s ?? 0)); }
        }
        // no máximo 1 empresa por campanha por rodada: atrasos (ex.: campanha retomada) não saem todos de uma vez
        const campSeen = new Set<string>();
        const activeDue = (dueAll ?? []).filter((r) => !r.campaign_id || !paused.has(r.campaign_id));
        const due = activeDue.filter((r) => {
          if (!r.campaign_id) return true;
          const k = `${r.campaign_id}|${r.phone}`;
          if (campSeen.has(r.campaign_id) && !campSeen.has(k)) return false;
          campSeen.add(r.campaign_id); campSeen.add(k); return true;
        }).slice(0, 6);
        const report: string[] = [];
        const blocked = new Set<string>();
        for (const row of due) {
          // mantém a ordem do funil: não envia a próxima mensagem se uma anterior da mesma empresa falhou/está pendente
          const key = `${row.campaign_id ?? "x"}|${row.phone}`;
          if (blocked.has(key)) continue;
          if (row.campaign_id) {
            const { count } = await supabaseAdmin.from("wa_scheduled").select("id", { count: "exact", head: true })
              .eq("campaign_id", row.campaign_id).eq("phone", row.phone).in("status", ["pendente", "enviando"]).lt("send_at", row.send_at);
            if (count) { blocked.add(key); continue; }
            // intervalo mínimo entre empresas contado do último envio real (atrasos não encurtam o intervalo)
            const gap = (campGap.get(row.campaign_id) ?? 0) * 1000;
            if (gap) {
              const { data: last } = await supabaseAdmin.from("wa_scheduled").select("sent_at").eq("campaign_id", row.campaign_id).eq("status", "enviada").neq("phone", row.phone).order("sent_at", { ascending: false }).limit(1);
              const lastAt = last?.[0]?.sent_at ? new Date(last[0].sent_at).getTime() : 0;
              if (lastAt && Date.now() - lastAt < gap) { blocked.add(key); const t = lastAt + gap; waRetryAt = waRetryAt ? Math.min(waRetryAt, t) : t; continue; }
            }
          }
          // reserva a linha para não enviar duas vezes
          const { data: claimed } = await supabaseAdmin.from("wa_scheduled")
            .update({ status: "enviando" }).eq("id", row.id).eq("status", "pendente").select("id");
          if (!claimed?.length) continue;
          try {
            await evoSend(row.instance, row.phone, row.texts);
            const now = new Date().toISOString();
            await supabaseAdmin.from("wa_scheduled").update({ status: "enviada", sent_at: now, error: null }).eq("id", row.id);
            {
              // no Pipeline: registra o contato e tira de "Novo" (não rebaixa quem já respondeu/avançou)
              const patch = { last_contact_at: now, message: row.texts.join("\n\n") };
              const [k, v] = row.lead_id ? ["id", row.lead_id] : ["phone", row.phone];
              await supabaseAdmin.from("leads").update(patch).eq(k, v).eq("user_id", row.user_id);
              await supabaseAdmin.from("leads").update({ status: "enviada" }).eq(k, v).eq("user_id", row.user_id).eq("status", "novo");
            }
            // etiqueta do WhatsApp Business "Lead - Google" na conversa da empresa abordada por campanha
            if (row.campaign_id) await evoLabel(row.instance, row.phone, "Lead - Google").catch(() => false);
            await notifyUser(supabaseAdmin, row.user_id, row.campaign_id ? "🦇 Campanha: mensagem enviada" : "🦇 Mensagem enviada", `Abordagem enviada para ${row.name}.`, row.campaign_id ? "/campanhas" : "/agendamentos").catch(() => 0);
            report.push(`ok ${row.id}`);
            // com o agendador a cada 18 min, as mensagens seguintes do funil (segundos depois) saem nesta mesma rodada, em ordem
            if (row.campaign_id) {
              const limit = new Date(new Date(row.send_at).getTime() + 10 * 60000).toISOString();
              const { data: nexts } = await supabaseAdmin.from("wa_scheduled").select("*").eq("campaign_id", row.campaign_id).eq("phone", row.phone)
                .eq("status", "pendente").gt("send_at", row.send_at).lte("send_at", limit).order("send_at").limit(3);
              let prev = new Date(row.send_at).getTime();
              for (const n of nexts ?? []) {
                // espera antes de reservar: se o cliente responder nesse meio-tempo, o aviso de resposta cancela esta mensagem
                await new Promise((r) => setTimeout(r, Math.min(30000, Math.max(3000, new Date(n.send_at).getTime() - prev))));
                prev = new Date(n.send_at).getTime();
                const { data: c2 } = await supabaseAdmin.from("wa_scheduled").update({ status: "enviando" }).eq("id", n.id).eq("status", "pendente").select("id");
                if (!c2?.length) break;
                try {
                  await evoSend(n.instance, n.phone, n.texts);
                  await supabaseAdmin.from("wa_scheduled").update({ status: "enviada", sent_at: new Date().toISOString(), error: null }).eq("id", n.id);
                } catch (e2) {
                  await supabaseAdmin.from("wa_scheduled").update({ status: "falhou", error: e2 instanceof Error ? e2.message : "falha" }).eq("id", n.id);
                  break;
                }
              }
              blocked.add(key);
            }
          } catch (e) {
            const raw = e instanceof Error ? e.message : "";
            // servidor do WhatsApp acordando/fora do ar (502/503/504/timeout): tenta de novo 2x antes de dar falha
            const tries = Number(/^Tentativa (\d)/.exec(row.error ?? "")?.[1] ?? 0);
            if ((/respondeu 50[234]/.test(raw) || (e instanceof Error && e.name === "TimeoutError")) && tries < 2) {
              const later = new Date(Date.now() + 10 * 60000).toISOString();
              await supabaseAdmin.from("wa_scheduled").update({ status: "pendente", error: `Tentativa ${tries + 1}: servidor do WhatsApp fora do ar`, send_at: later }).eq("id", row.id);
              await supabaseAdmin.from("wa_scheduled").update({ send_at: later }).eq("campaign_id", row.campaign_id ?? "00000000-0000-0000-0000-000000000000").eq("phone", row.phone).eq("status", "pendente").lt("send_at", later).neq("id", row.id);
              waRetryAt = waRetryAt ? Math.min(waRetryAt, Date.parse(later)) : Date.parse(later);
              blocked.add(key); report.push(`retry ${row.id}`); continue;
            }
            const msg = e instanceof Error && e.name === "TimeoutError" ? "Servidor demorou a responder (confira no WhatsApp se chegou)." : e instanceof Error ? e.message : "falha";
            await supabaseAdmin.from("wa_scheduled").update({ status: "falhou", error: msg }).eq("id", row.id);
            // número sem WhatsApp: as próximas mensagens do funil também falhariam, então já são encerradas
            if (row.campaign_id && /"exists":\s*false/.test(msg)) await supabaseAdmin.from("wa_scheduled").update({ status: "falhou", error: msg }).eq("campaign_id", row.campaign_id).eq("phone", row.phone).eq("status", "pendente");
            const why = /"exists":\s*false/.test(msg) ? "o número não tem WhatsApp" : /demorou/.test(msg) ? "o servidor demorou a responder" : "erro no envio";
            await notifyUser(supabaseAdmin, row.user_id, "⚠️ Falha no envio", `${row.name}: ${why}.`, row.campaign_id ? "/campanhas" : "/agendamentos").catch(() => 0);
            blocked.add(key);
            report.push(`erro ${row.id}`);
          }
        }
        // Papa Lead: fila própria, independente do BatRadar
        const pl = supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient;
        const { data: plDue } = await pl.from("pl_queue").select("*").eq("status", "pendente")
          .lte("send_at", new Date().toISOString()).order("send_at").limit(10);
        const plCamp = [...new Set((plDue ?? []).map((r) => r.campaign_id as string))];
        const plActive = new Map<string, { instance: string; gap: number }>();
        if (plCamp.length) {
          const { data: cs } = await pl.from("pl_campaigns").select("id,status,instance,min_gap_min").in("id", plCamp);
          for (const c of cs ?? []) if (c.status === "ativa") plActive.set(c.id as string, { instance: String(c.instance ?? ""), gap: Number(c.min_gap_min ?? 1) });
        }
        await pl.from("pl_queue").update({ status: "falhou", error: "Envio interrompido; confira no WhatsApp e tente de novo." }).eq("status", "enviando").lt("send_at", stale);
        // no máximo 1 contato por campanha a cada rodada, e nunca antes do intervalo mínimo desde o último envio
        const seenCamp = new Set<string>();
        let plRetryAt: number | null = null;
        const plPick: typeof plDue = [];
        for (const r of plDue ?? []) {
          const id = r.campaign_id as string;
          const camp = plActive.get(id);
          if (!camp) continue;
          if (seenCamp.has(id)) { plRetryAt = Math.min(plRetryAt ?? Infinity, Date.now() + camp.gap * 60000); continue; }
          seenCamp.add(id);
          const { data: last } = await pl.from("pl_queue").select("sent_at").eq("campaign_id", id).eq("status", "enviada").order("sent_at", { ascending: false }).limit(1);
          const lastAt = last?.[0]?.sent_at ? new Date(last[0].sent_at as string).getTime() : 0;
          const okAt = lastAt + (camp.gap - 0.5) * 60000;
          if (okAt > Date.now()) { plRetryAt = Math.min(plRetryAt ?? Infinity, okAt); continue; }
          plPick.push(r);
        }
        for (const row of plPick.slice(0, 4)) {
          const { data: claimed } = await pl.from("pl_queue").update({ status: "enviando" }).eq("id", row.id).eq("status", "pendente").select("id");
          if (!claimed?.length) continue;
          try {
            await evoSend(plActive.get(row.campaign_id as string)?.instance ?? "", row.phone as string, row.texts as string[]);
            await pl.from("pl_queue").update({ status: "enviada", sent_at: new Date().toISOString(), error: null }).eq("id", row.id);
            report.push(`pl ok ${row.id}`);
          } catch (e) {
            await pl.from("pl_queue").update({ status: "falhou", error: e instanceof Error ? e.message : "falha" }).eq("id", row.id);
            report.push(`pl erro ${row.id}`);
          }
        }
        // Despertador: se o próximo envio cai antes da rodada fixa de 18 min, agenda uma rodada extra no minuto exato
        try {
          const nowIso = new Date().toISOString();
          const [{ data: nextWa }, { data: nextPl }] = await Promise.all([
            supabaseAdmin.from("wa_scheduled").select("send_at").eq("status", "pendente").gt("send_at", nowIso).order("send_at").limit(1),
            pl.from("pl_queue").select("send_at").eq("status", "pendente").gt("send_at", nowIso).order("send_at").limit(1),
          ]);
          const cands = [nextWa?.[0]?.send_at, nextPl?.[0]?.send_at].filter(Boolean).map((s) => new Date(s as string).getTime());
          if (plRetryAt) cands.push(plRetryAt);
          if (waRetryAt) cands.push(waRetryAt);
          if (activeDue.length > due.length) cands.push(Date.now() + 3 * 60000);
          if (cands.length) {
            const at = Math.min(...cands);
            const d = new Date(); d.setUTCSeconds(0, 0);
            const nextTick = d.getTime() + (18 - (d.getUTCMinutes() % 18)) * 60000;
            if (at < nextTick) {
              const { data: wake } = await pl.rpc("schedule_dispatch_wake", { _at: new Date(at).toISOString() });
              report.push(`wake ${wake}`);
            }
          }
        } catch { /* a rodada fixa de 18 min continua valendo */ }
        try {
          const { processAgentQueue } = await import("@/lib/agents.server");
          report.push(`agentes ${await processAgentQueue(supabaseAdmin as any)}`);
        } catch (e) { console.error("agent queue", e); }
        return Response.json({ ok: true, report });
      },
    },
  },
});
