import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Pause, Pencil, Play, Plus, RefreshCw, Rocket, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { planCompanyTimes } from "@/lib/campaign-schedule";
import { fmtWhen } from "@/components/PapaLead";
import { CampaignWizard, type Form } from "@/components/CampaignWizard";
import { CampaignMetrics } from "@/components/CampaignMetrics";
import { leadsKey, listLeads } from "@/lib/leads";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { blocksKey, listBlockItems, ensureInPipeline, listBlocks } from "@/lib/blocks";
import { distributeVariants, fillScript, listScripts, scriptMessages, scriptsKey } from "@/lib/scripts";
import { waList } from "@/lib/whatsapp.functions";
import { plWake } from "@/lib/papalead.functions";
import { TEST_PACK } from "@/lib/test-pack";

export const Route = createFileRoute("/_authenticated/campanhas")({
  head: () => ({ meta: [
    { title: "Campanhas — BatRadar 5.7" }, { name: "description", content: "Automatize abordagens por WhatsApp com blocos de leads e funis de mensagens." },
    { property: "og:title", content: "Campanhas — BatRadar 5.7" }, { property: "og:description", content: "Campanhas agendadas de abordagem por WhatsApp." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: CampaignsPage,
});

type Row = { id: string; name: string; status: string; instance: string; start_at: string; block_id: string | null; script_id: string | null; texts: string[]; msg_gap_s: number; min_gap_s: number; max_gap_s: number; from_h: number; to_h: number; days: number[]; daily_limit: number };
type Sched = { campaign_id: string | null; status: string; send_at: string; phone: string; name: string; texts: string[] | null };


function CampaignsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(waList);
  const wake = useServerFn(plWake);
  const { data: instances = [] } = useQuery({ queryKey: ["wa_instances"], queryFn: () => listFn(), retry: 1 });
  const { data: blocks = [] } = useQuery({ queryKey: blocksKey, queryFn: listBlocks });
  const { data: scripts = [] } = useQuery({ queryKey: scriptsKey, queryFn: listScripts });
  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"], 
    queryFn: async () => ((await supabase.from("campaigns").select("id,name,status,instance,start_at,block_id,script_id,texts,msg_gap_s,min_gap_s,max_gap_s,from_h,to_h,days,daily_limit").order("created_at", { ascending: false })).data ?? []) as Row[],
  });
  const { data: sched = [] } = useQuery({
    queryKey: ["wa_scheduled", "campaigns"],
    queryFn: async () => ((await supabase.from("wa_scheduled").select("campaign_id,status,send_at,phone,name,texts").not("campaign_id", "is", null).limit(5000)).data ?? []) as Sched[],
  });

  const { data: leads = [] } = useQuery({ queryKey: leadsKey, queryFn: listLeads });
  const connected = instances.filter((i) => i.status === "open");
  const [wizard, setWizard] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [updatedAt, setUpdatedAt] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"campanhas" | "metricas">("campanhas");
  const refresh = async (notify = false) => {
    setRefreshing(true);
    try {
      await Promise.all([
        qc.refetchQueries({ queryKey: ["campaigns"] }), qc.refetchQueries({ queryKey: ["wa_scheduled"] }),
        qc.refetchQueries({ queryKey: ["metricas"] }), qc.refetchQueries({ queryKey: blocksKey }), qc.refetchQueries({ queryKey: ["wa_instances"] }),
      ]);
      setUpdatedAt(new Date());
      if (notify) toast.success("Dados atualizados");
    } catch { toast.error("Não foi possível atualizar"); } finally { setRefreshing(false); }
  };
  const toLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const nextPend = editing ? sched.filter((s) => s.campaign_id === editing.id && s.status === "pendente").map((s) => new Date(s.send_at).getTime()).sort((a, b) => a - b)[0] : undefined;
  const editForm: Form | null = useMemo(() => editing ? { name: editing.name, instance: editing.instance, dailyLimit: editing.daily_limit, target: "bloco", block: editing.block_id ?? "", lead: "", start: toLocal(new Date(Math.max(Date.now() + 5 * 60000, nextPend ?? 0))), fromH: editing.from_h, toH: editing.to_h, days: editing.days, script: editing.script_id ?? "", msgGap: editing.msg_gap_s, minGap: editing.min_gap_s, maxGap: editing.max_gap_s, now: false } : null, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  // reprograma os envios aguardando, empresa por empresa, mantendo a ordem do funil
  async function reschedule(c: Pick<Row, "id">, cfg: { fromH: number; toH: number; days: number[]; dailyLimit: number; msgGap: number; minGap: number; maxGap: number }, startMs: number, instance: string | null, ignoreWindow = false) {
    const { data } = await supabase.from("wa_scheduled").select("id,phone,send_at").eq("campaign_id", c.id).eq("status", "pendente").order("send_at").limit(5000);
    const groups = new Map<string, string[]>();
    for (const r of data ?? []) groups.set(r.phone, [...(groups.get(r.phone) ?? []), r.id]);
    const list = [...groups.values()];
    const maxMsgs = Math.max(1, ...list.map((g) => g.length));
    const times = planCompanyTimes(list.length, maxMsgs, cfg, startMs, ignoreWindow);
    for (let i = 0; i < list.length; i++) {
      await Promise.all(list[i]!.map((id, j) => supabase.from("wa_scheduled").update({ send_at: new Date(times[i]! + j * cfg.msgGap * 1000).toISOString(), ...(instance ? { instance } : {}) }).eq("id", id)));
    }
    return list.length;
  }

  async function saveEdit(f: Form) {
    if (!editing) return;
    const { error } = await supabase.from("campaigns").update({ name: f.name.trim().slice(0, 120), instance: f.instance, msg_gap_s: f.msgGap, min_gap_s: f.minGap, max_gap_s: f.maxGap, from_h: f.fromH, to_h: f.toH, days: f.days, daily_limit: f.dailyLimit }).eq("id", editing.id);
    if (error) throw error;
    const n = await reschedule(editing, f, new Date(f.start).getTime(), f.instance);
    try { await wake(); } catch { /* rodada fixa */ }
    toast.success(`Campanha atualizada: ${n} empresa(s) reprogramada(s).`);
    setEditing(null); refresh();
  }

  async function startNow(c: Row) {
    if (!confirm("Começar agora? Os envios aguardando passam a sair em instantes, ignorando horário e dias da campanha, mas mantendo os intervalos entre empresas.")) return;
    await supabase.from("campaigns").update({ status: "ativa" }).eq("id", c.id);
    const n = await reschedule(c, { fromH: c.from_h, toH: c.to_h, days: c.days, dailyLimit: c.daily_limit, msgGap: c.msg_gap_s, minGap: c.min_gap_s, maxGap: c.max_gap_s }, Date.now() + 20000, null, true);
    setTimeout(async () => { try { await wake(); } catch { /* rodada fixa */ } refresh(); }, 25000);
    toast.success(`${n} empresa(s) antecipada(s). A primeira sai em cerca de 30 segundos.`);
    refresh();
  }

  async function launch(f: Form) {
    const script = scripts.find((s) => s.id === f.script);
    if (!script) throw new Error("Escolha um script.");
    const msgs = scriptMessages(script);
    if (!msgs.length) throw new Error("O script não tem mensagens.");
    type It = { name: string; phone: string | null; city: string | null; niche: string | null; rating: number | null; reviews: number | null; website: string | null; leadId: string | null };
    let items: It[];
    if (f.target === "pack") {
      items = TEST_PACK.map((t) => ({ name: t.name, phone: t.phone, city: null, niche: null, rating: null, reviews: null, website: null, leadId: null }));
    } else if (f.target === "bloco" || f.target === "falhas") {
      const bi = await listBlockItems(f.block);
      const ids = await ensureInPipeline(bi);
      items = bi.map((i) => ({ name: i.name, phone: i.phone, city: i.city, niche: i.niche, rating: i.rating, reviews: i.reviews_count, website: i.website, leadId: ids.get(i.place_id) ?? null }));
    } else {
      const l = leads.find((x) => x.id === f.lead);
      items = l ? [{ name: l.name, phone: l.phone, city: l.city, niche: l.niche, rating: l.rating, reviews: l.reviews_count, website: l.website, leadId: l.id }] : [];
    }
    items = items.filter((i) => i.phone);
    if (f.target === "falhas") {
      const { data: ok } = await supabase.from("wa_scheduled").select("phone").in("status", ["enviada", "pendente", "enviando"]).in("phone", items.map((i) => i.phone!)).limit(5000);
      const got = new Set((ok ?? []).map((d) => d.phone));
      items = items.filter((i) => !got.has(i.phone!));
      if (!items.length) throw new Error("Nenhuma empresa com erro ou sem envio neste bloco.");
    }
    if (!items.length) throw new Error("Nenhuma empresa com telefone no público escolhido.");
    // empresas já abordadas só entram de novo com outro objetivo (follow-up, reunião, proposta, reativação)
    if (f.target !== "pack" && (script.stage || "primeiro_contato") === "primeiro_contato") {
      const { data: done } = await supabase.from("wa_scheduled").select("phone").eq("status", "enviada").in("phone", items.map((i) => i.phone!)).limit(5000);
      const sent = new Set((done ?? []).map((d) => d.phone));
      const before = items.length;
      items = items.filter((i) => !sent.has(i.phone!));
      if (!items.length) throw new Error("Todas essas empresas já foram abordadas. Use um script de Follow-up (ou outro objetivo) para falar com elas de novo.");
      if (items.length < before) toast.info(`${before - items.length} empresa(s) já abordada(s) ficaram de fora. Para elas, use um script de Follow-up.`);
    }
    // grava sempre a configuração escolhida; "Começar agora" só muda o cálculo dos horários desta vez
    const cfg = f;
    const startMs = f.now ? Date.now() + 20000 : new Date(f.start).getTime();
    const { data: c, error } = await supabase.from("campaigns").insert({
      name: f.name.trim().slice(0, 120), block_id: f.target === "bloco" || f.target === "falhas" ? f.block : null, script_id: script.id, instance: f.instance, texts: msgs,
      msg_gap_s: cfg.msgGap, min_gap_s: cfg.minGap, max_gap_s: Math.max(cfg.minGap, cfg.maxGap), from_h: cfg.fromH, to_h: cfg.toH, days: cfg.days, daily_limit: cfg.dailyLimit, start_at: new Date(startMs).toISOString(),
    }).select("id").single();
    if (error) throw error;
    const times = planCompanyTimes(items.length, msgs.length, cfg, startMs, f.now);
    const funnels = distributeVariants(script, items.length);
    const rows: { campaign_id: string; instance: string; lead_id: string | null; name: string; phone: string; texts: string[]; send_at: string }[] = [];
    items.forEach((it, k) => funnels[k]!.forEach((m, i) => rows.push({ campaign_id: c.id, instance: f.instance, lead_id: it.leadId, name: it.name, phone: it.phone!, texts: [fillScript(m, it)], send_at: new Date(times[k]! + i * f.msgGap * 1000).toISOString() })));
    for (let i = 0; i < rows.length; i += 500) {
      const { error: e2 } = await supabase.from("wa_scheduled").insert(rows.slice(i, i + 500));
      if (e2) throw e2;
    }
    toast.success(`Campanha publicada: ${items.length} empresa(s), ${rows.length} mensagens agendadas.`);
    try { await wake(); } catch { /* a rodada fixa continua valendo */ }
    qc.invalidateQueries({ queryKey: ["campaigns"] }); qc.invalidateQueries({ queryKey: ["wa_scheduled"] });
  }

  async function setStatus(id: string, status: string) {
    await supabase.from("campaigns").update({ status }).eq("id", id);
    if (status === "ativa") { try { await wake(); } catch { /* rodada fixa */ } }
    qc.invalidateQueries({ queryKey: ["campaigns"] });
  }
  async function remove(id: string) {
    if (!confirm("Excluir a campanha e cancelar os envios pendentes?")) return;
    await supabase.from("campaigns").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["campaigns"] }); qc.invalidateQueries({ queryKey: ["wa_scheduled"] });
  }

  const stats = useMemo(() => {
    const m = new Map<string, { total: number; sent: number; failed: number; next: string | null; last: string | null; firms: Set<string>; reached: Set<string>; texts: Set<string> }>();
    for (const s of sched) {
      const k = s.campaign_id!; const v = m.get(k) ?? { total: 0, sent: 0, failed: 0, next: null, last: null, firms: new Set<string>(), reached: new Set<string>(), texts: new Set<string>() };
      v.total++; v.firms.add(s.phone); v.texts.add((s.texts ?? []).join("|").replace(new RegExp(s.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "")); if (s.status === "enviada") { v.sent++; v.reached.add(s.phone); }
      if (!v.last || s.send_at > v.last) v.last = s.send_at; if (s.status === "falhou") v.failed++;
      if (s.status === "pendente" && (!v.next || s.send_at < v.next)) v.next = s.send_at;
      m.set(k, v);
    }
    return m;
  }, [sched]);

  return (
    <AppShell>
      <p className="text-xs font-semibold uppercase text-primary">Automação</p>
      <h1 className="text-3xl font-bold">Campanhas</h1>
      <p className="mt-1 text-sm text-muted-foreground">Escolha o bloco, o funil de mensagens e o número. O envio roda sozinho, mesmo com o app fechado.</p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button onClick={() => setWizard(true)}><Plus className="h-4 w-4" /> Criar campanha</Button>
        <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={refreshing}><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> {refreshing ? "Atualizando..." : "Atualizar"}</Button>
        <span className="text-xs text-muted-foreground">Atualizado {fmtWhen(updatedAt)}</span>
      </div>
      <div className="mt-4 flex gap-2">
        {(["campanhas", "metricas"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full border px-3 py-1 text-sm ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t === "campanhas" ? "Suas campanhas" : "Métricas"}</button>
        ))}
      </div>
      <CampaignWizard open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }} initial={editForm} blocks={blocks} scripts={scripts} connected={connected} leads={[]} onPublish={saveEdit} />
      <CampaignWizard open={wizard} onOpenChange={setWizard} blocks={blocks} scripts={scripts} connected={connected} leads={leads.filter((l) => l.phone)} onPublish={launch} />

      {tab === "metricas" ? <div className="mt-6"><CampaignMetrics /></div> : (
      <section className="mt-6 grid gap-3">
        {campaigns.length === 0 && <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma campanha ainda.</p>}
        {campaigns.map((c) => {
          const s = stats.get(c.id) ?? { total: 0, sent: 0, failed: 0, next: null, last: null, firms: new Set<string>(), reached: new Set<string>(), texts: new Set<string>() };
          const done = s.total > 0 && s.sent + s.failed >= s.total;
          const label = done ? "Concluída" : c.status === "pausada" ? "Pausada" : new Date(c.start_at) > new Date() ? "Agendada" : "Em andamento";
          const pct = s.total ? Math.round(((s.sent + s.failed) / s.total) * 100) : 0;
          const risk = googleRisk(c, s.failed, s.sent, s.texts.size, s.firms.size);
          const RiskIcon = risk.level === "alto" ? ShieldAlert : risk.level === "moderado" ? AlertTriangle : ShieldCheck;
          return (
            <article key={c.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{c.name} <span className="ml-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">{label}</span>
                    <span title={`Risco de bloqueio: ${risk.score}/100`} className={`ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${risk.level === "alto" ? "bg-destructive/15 text-destructive" : risk.level === "moderado" ? "bg-accent/20 text-accent-foreground" : "bg-muted text-muted-foreground"}`}><RiskIcon className="h-3 w-3" /> Risco {risk.level}</span></p>
                  <p className="text-xs text-muted-foreground">
                    {c.block_id ? blocks.find((b) => b.id === c.block_id)?.name ?? "Bloco removido" : "Empresa única"} · {scripts.find((x) => x.id === c.script_id)?.title ?? "Script"} · início {fmtWhen(c.start_at)} · {c.from_h % 12 || 12} {c.from_h < 12 || c.from_h === 24 ? "AM" : "PM"} às {c.to_h % 12 || 12} {c.to_h < 12 || c.to_h === 24 ? "AM" : "PM"}
                  </p>
                </div>
                {!done && (c.status === "pausada"
                  ? <Button size="sm" variant="outline" onClick={() => setStatus(c.id, "ativa")}><Play className="h-4 w-4" /> Retomar</Button>
                  : <Button size="sm" variant="outline" onClick={() => setStatus(c.id, "pausada")}><Pause className="h-4 w-4" /> Pausar</Button>)}
                {!done && s.total - s.sent - s.failed > 0 && <Button size="sm" onClick={() => startNow(c)}><Rocket className="h-4 w-4" /> Começar agora</Button>}
                <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
                {[["Enviadas", s.sent], ["Faltam", s.total - s.sent - s.failed], ["Falharam", s.failed], ["Empresas", `${s.reached.size}/${s.firms.size}`], ["Concluído", `${pct}%`]].map(([k, v]) => (
                  <div key={k as string} className="rounded-md bg-muted p-2"><p className="text-lg font-bold">{v}</p><p className="text-xs text-muted-foreground">{k}</p></div>
                ))}
              </div>
              <div className={`mt-3 rounded-md border p-3 text-sm ${risk.level === "alto" ? "border-destructive/50 bg-destructive/10" : risk.level === "moderado" ? "border-primary/50 bg-primary/10" : ""}`}>
                <p className="flex items-center gap-1.5 font-semibold"><RiskIcon className="h-4 w-4" /> Chance de bloqueio: {risk.level === "alto" ? "Alta" : risk.level === "moderado" ? "Moderada" : "Baixa"} ({risk.score}/100)</p>
                {risk.tips.length > 0 ? <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">{risk.tips.map((t) => <li key={t}>{t}</li>)}</ul> : <p className="text-xs text-muted-foreground">Ritmo dentro do recomendado.</p>}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {s.next && c.status !== "pausada" ? `Próxima: ${fmtWhen(s.next)}` : ""}
                {s.last ? ` · Término previsto: ${fmtWhen(s.last)}` : ""}
              </p>
            </article>
          );
        })}
      </section>)}
    </AppShell>
  );
}

function googleRisk(c: Row, fail: number, sent: number, variations: number, firms: number) {
  let score = 0; const tips: string[] = [];
  if (c.daily_limit === 0 || c.daily_limit > 30) { score += 30; tips.push(c.daily_limit === 0 ? "Sem limite diário: o recomendado é até 15 empresas por dia." : "Mais de 30 empresas por dia é arriscado; o recomendado é até 15."); }
  else if (c.daily_limit > 15) { score += 15; tips.push("Acima de 15 empresas por dia aumenta o risco."); }
  if (c.min_gap_s < 120) { score += 25; tips.push("Menos de 2 min entre empresas parece robô; use 5–12 min."); }
  else if (c.min_gap_s < 300) { score += 10; tips.push("Intervalos de 5–12 min entre empresas são os mais seguros."); }
  if (c.msg_gap_s < 10) { score += 10; tips.push("Mensagens do funil muito coladas; use 20 s ou mais."); }
  if (firms > 3 && variations <= Math.max(1, Math.ceil(firms * 0.2))) { score += 15; tips.push("Textos muito parecidos; crie variações no script."); }
  if (c.from_h < 8 || c.to_h > 20) { score += 10; tips.push("Enviar fora do horário comercial gera mais denúncias."); }
  if (c.days.includes(0) || c.days.includes(6)) score += 5;
  if (sent + fail >= 3 && fail / (sent + fail) > 0.2) { score += 20; tips.push("Muitas falhas: confira os números e a conexão."); }
  score = Math.min(100, score);
  return { score, tips, level: score >= 50 ? "alto" : score >= 25 ? "moderado" : "baixo" } as const;
}
