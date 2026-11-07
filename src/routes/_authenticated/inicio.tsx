import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Send, MessageCircle, Flame, Trophy, AlertTriangle, ListOrdered } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AgentAvatar } from "@/components/AgentAvatar";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({ meta: [
    { title: "Início — BatRadar" }, { name: "description", content: "Central do painel: abordagens, respostas, fechamentos e desempenho dos agentes." },
    { property: "og:title", content: "Início — BatRadar" }, { property: "og:description", content: "Números do painel e dos agentes num só lugar." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});

const SENT = ["abordado", "respondeu", "quente", "fechado", "perdido"];
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

async function load() {
  const sb = supabase as any;
  const [ags, als, msgs, leads] = await Promise.all([
    sb.from("agents").select("id,name,active,squad,avatar_url,instance"),
    sb.from("agent_leads").select("agent_id,status,created_at"),
    sb.from("agent_messages").select("agent_id,phone,direction,created_at").limit(5000),
    sb.from("leads").select("status"),
  ]);
  const al = (als.data ?? []) as any[]; const ms = (msgs.data ?? []) as any[]; const ld = (leads.data ?? []) as any[];
  const since = Date.now() - 86400000;
  const outPhones = new Set(ms.filter((m) => m.direction === "out").map((m) => `${m.agent_id}|${m.phone}`));
  const inPhones = new Set(ms.filter((m) => m.direction === "in" && outPhones.has(`${m.agent_id}|${m.phone}`)).map((m) => `${m.agent_id}|${m.phone}`));
  const agents = ((ags.data ?? []) as any[]).map((g) => {
    const mine = al.filter((l) => l.agent_id === g.id);
    const contacted = [...outPhones].filter((k) => k.startsWith(g.id)).length;
    const replied = [...inPhones].filter((k) => k.startsWith(g.id)).length;
    return { ...g, contacted, replied, fila: mine.filter((l) => l.status === "fila").length, erros: mine.filter((l) => l.status === "erro" || l.status === "revisao").length, quentes: mine.filter((l) => l.status === "quente").length };
  }).sort((a, b) => b.replied - a.replied);
  const contacted = outPhones.size, replied = inPhones.size;
  const closed = ld.filter((l) => /fech|ganh|client/i.test(l.status ?? "")).length;
  return {
    agents, contacted, replied, closed,
    today: ms.filter((m) => m.direction === "out" && new Date(m.created_at).getTime() > since).length,
    fila: al.filter((l) => l.status === "fila").length,
    hot: al.filter((l) => l.status === "quente").length,
    pipeline: ld.length, sentAny: al.filter((l) => SENT.includes(l.status)).length,
  };
}

function Page() {
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: load, refetchInterval: 60000 });
  const d = data;
  const cards = [
    { t: "Abordados", v: d?.contacted ?? 0, s: `${d?.today ?? 0} mensagens nas últimas 24h`, i: Send },
    { t: "Taxa de resposta", v: pct(d?.replied ?? 0, d?.contacted ?? 0), s: `${d?.replied ?? 0} responderam`, i: MessageCircle },
    { t: "Leads quentes", v: d?.hot ?? 0, s: "pediram mais informações", i: Flame },
    { t: "Fechamentos", v: d?.closed ?? 0, s: `taxa ${pct(d?.closed ?? 0, d?.pipeline ?? 0)} do pipeline`, i: Trophy },
    { t: "Na fila", v: d?.fila ?? 0, s: "aguardando envio", i: ListOrdered },
  ];
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-5 p-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><LayoutDashboard className="h-6 w-6" /> Início</h1>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {cards.map((c) => (
            <div key={c.t} className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">{c.t}<c.i className="h-4 w-4 text-primary" /></div>
              <div className="mt-1 text-2xl font-bold">{c.v}</div>
              <div className="text-[11px] text-muted-foreground">{c.s}</div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 font-semibold">Funil</h2>
          {[["Abordados", d?.contacted ?? 0], ["Responderam", d?.replied ?? 0], ["Quentes", d?.hot ?? 0], ["Fechados", d?.closed ?? 0]].map(([n, v], i, arr) => (
            <div key={n as string} className="mb-2">
              <div className="flex justify-between text-xs"><span>{n}</span><span>{v as number}</span></div>
              <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${Math.max(2, ((v as number) / Math.max(1, arr[0]![1] as number)) * 100)}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border bg-card">
          <h2 className="border-b p-4 font-semibold">Ranking dos agentes</h2>
          {!d?.agents.length && <p className="p-4 text-sm text-muted-foreground">Nenhum agente ainda.</p>}
          {d?.agents.map((a, i) => (
            <Link key={a.id} to="/agentes/$id" params={{ id: a.id }} className="flex flex-wrap items-center gap-3 border-b p-3 last:border-0 hover:bg-muted/40">
              <span className="w-5 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
              <AgentAvatar id={a.id} name={a.name} url={a.avatar_url} />
              <div className="min-w-[140px] flex-1">
                <div className="font-medium">{a.name}</div>
                <div className="text-[11px] text-muted-foreground">{a.active ? "ligado" : "desligado"} · {a.squad === "v3" ? "Agentes V3" : a.squad === "agts01" ? "AGTS - 01" : a.squad === "v2" ? "V2" : "Agentes"} · {a.instance || "sem número"}</div>
              </div>
              <div className="grid grid-cols-4 gap-4 text-center text-xs">
                <div><div className="font-bold">{a.contacted}</div>abord.</div>
                <div><div className="font-bold">{pct(a.replied, a.contacted)}</div>resp.</div>
                <div><div className="font-bold">{a.fila}</div>fila</div>
                <div className={a.erros ? "text-destructive" : ""}><div className="flex items-center justify-center gap-1 font-bold">{a.erros ? <AlertTriangle className="h-3 w-3" /> : null}{a.erros}</div>erros</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
