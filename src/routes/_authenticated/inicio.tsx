import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Send, MessageCircle, Flame, Trophy, AlertTriangle, ListOrdered, Radar, Activity, Zap } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
const C = ["var(--primary)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--muted-foreground)"];
const tip = { contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 } };

async function load() {
  const sb = supabase as any;
  const since14 = new Date(Date.now() - 14 * 86400000).toISOString();
  const [ags, als, msgs, leads, evs] = await Promise.all([
    sb.from("agents").select("id,name,active,squad,avatar_url,instance"),
    sb.from("agent_leads").select("agent_id,status,created_at"),
    sb.from("agent_messages").select("agent_id,phone,direction,created_at").limit(5000),
    sb.from("leads").select("status"),
    sb.from("agent_events").select("agent_id,kind,text,created_at").order("created_at", { ascending: false }).limit(12),
  ]);
  const al = (als.data ?? []) as any[]; const ms = (msgs.data ?? []) as any[]; const ld = (leads.data ?? []) as any[];
  const since = Date.now() - 86400000;
  const outPhones = new Set(ms.filter((m) => m.direction === "out").map((m) => `${m.agent_id}|${m.phone}`));
  const inPhones = new Set(ms.filter((m) => m.direction === "in" && outPhones.has(`${m.agent_id}|${m.phone}`)).map((m) => `${m.agent_id}|${m.phone}`));
  const names: Record<string, string> = {};
  const agents = ((ags.data ?? []) as any[]).map((g) => {
    names[g.id] = g.name;
    const mine = al.filter((l) => l.agent_id === g.id);
    const contacted = [...outPhones].filter((k) => k.startsWith(g.id)).length;
    const replied = [...inPhones].filter((k) => k.startsWith(g.id)).length;
    return { ...g, contacted, replied, fila: mine.filter((l) => l.status === "fila").length, erros: mine.filter((l) => l.status === "erro" || l.status === "revisao").length, quentes: mine.filter((l) => l.status === "quente").length };
  }).sort((a, b) => b.replied - a.replied);
  // série diária 14 dias
  const days: { d: string; enviadas: number; recebidas: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const dt = new Date(Date.now() - i * 86400000);
    days.push({ d: `${dt.getDate()}/${dt.getMonth() + 1}`, enviadas: 0, recebidas: 0 });
  }
  for (const m of ms) {
    if (m.created_at < since14) continue;
    const dt = new Date(m.created_at); const k = `${dt.getDate()}/${dt.getMonth() + 1}`;
    const row = days.find((x) => x.d === k); if (!row) continue;
    if (m.direction === "out") row.enviadas++; else row.recebidas++;
  }
  const statusCount: Record<string, number> = {};
  for (const l of al) statusCount[l.status ?? "novo"] = (statusCount[l.status ?? "novo"] ?? 0) + 1;
  const status = Object.entries(statusCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const contacted = outPhones.size, replied = inPhones.size;
  const closed = ld.filter((l) => /fech|ganh|client/i.test(l.status ?? "")).length;
  return {
    agents, contacted, replied, closed, days, status, names,
    events: (evs.data ?? []) as any[],
    mined: al.length,
    today: ms.filter((m) => m.direction === "out" && new Date(m.created_at).getTime() > since).length,
    fila: al.filter((l) => l.status === "fila").length,
    hot: al.filter((l) => l.status === "quente").length,
    active: agents.filter((a) => a.active).length,
    pipeline: ld.length, sentAny: al.filter((l) => SENT.includes(l.status)).length,
  };
}

function Panel({ title, icon: I, children, className = "" }: { title: string; icon: any; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border bg-card/80 p-4 shadow-sm backdrop-blur ${className}`}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground"><I className="h-4 w-4 text-primary" />{title}</h2>
      {children}
    </div>
  );
}

function Page() {
  const { data: d } = useQuery({ queryKey: ["dashboard"], queryFn: load, refetchInterval: 60000 });
  const cards = [
    { t: "Abordados", v: d?.contacted ?? 0, s: `${d?.today ?? 0} msgs nas últimas 24h`, i: Send },
    { t: "Taxa de resposta", v: pct(d?.replied ?? 0, d?.contacted ?? 0), s: `${d?.replied ?? 0} responderam`, i: MessageCircle },
    { t: "Leads quentes", v: d?.hot ?? 0, s: "pediram mais informações", i: Flame },
    { t: "Fechamentos", v: d?.closed ?? 0, s: `${pct(d?.closed ?? 0, d?.pipeline ?? 0)} do pipeline`, i: Trophy },
    { t: "Na fila", v: d?.fila ?? 0, s: "aguardando envio", i: ListOrdered },
  ];
  const funnel = [["Mineradas", d?.mined ?? 0], ["Abordadas", d?.contacted ?? 0], ["Responderam", d?.replied ?? 0], ["Quentes", d?.hot ?? 0], ["Fechadas", d?.closed ?? 0]] as const;
  const bars = (d?.agents ?? []).filter((a) => a.contacted || a.fila).slice(0, 8).map((a) => ({ name: a.name.split(" ")[0], abordados: a.contacted, responderam: a.replied }));
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-4 p-4">
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-card to-card p-5">
          <Radar className="absolute -right-6 -top-6 h-40 w-40 text-primary/10" />
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Central BatRadar</p>
          <h1 className="mt-1 text-3xl font-bold">Visão da noite</h1>
          <p className="mt-1 text-sm text-muted-foreground">{d?.active ?? 0} agentes ligados · {d?.agents.length ?? 0} no esquadrão · atualiza a cada minuto</p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {cards.map((c) => (
            <div key={c.t} className="group rounded-2xl border bg-card p-4 transition hover:border-primary/60">
              <div className="flex items-center justify-between text-xs text-muted-foreground">{c.t}<span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10"><c.i className="h-4 w-4 text-primary" /></span></div>
              <div className="mt-2 text-3xl font-bold tabular-nums">{c.v}</div>
              <div className="text-[11px] text-muted-foreground">{c.s}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Mensagens — 14 dias" icon={Activity} className="lg:col-span-2">
            <div className="h-56">
              <ResponsiveContainer>
                <AreaChart data={d?.days ?? []}>
                  <defs>
                    <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.5} /><stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="d" fontSize={11} stroke="var(--muted-foreground)" />
                  <YAxis fontSize={11} stroke="var(--muted-foreground)" allowDecimals={false} width={28} />
                  <Tooltip {...tip} />
                  <Area type="monotone" dataKey="enviadas" stroke="var(--primary)" fill="url(#gOut)" strokeWidth={2} />
                  <Area type="monotone" dataKey="recebidas" stroke="var(--chart-2)" fill="url(#gIn)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="Carteira dos agentes" icon={Radar}>
            <div className="h-56">
              {d?.status.length ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={d.status} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {d.status.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                    </Pie>
                    <Tooltip {...tip} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="grid h-full place-items-center text-sm text-muted-foreground">Sem empresas ainda.</p>}
            </div>
            <div className="flex flex-wrap gap-2 text-[11px]">{d?.status.map((s, i) => <span key={s.name} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: C[i % C.length] }} />{s.name} {s.value}</span>)}</div>
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Funil de conversão" icon={Zap}>
            {funnel.map(([n, v], i) => {
              const top = Math.max(1, funnel[0][1]);
              return (
                <div key={n} className="mb-3">
                  <div className="flex justify-between text-xs"><span>{n}</span><span className="tabular-nums">{v}{i > 0 && <span className="ml-1 text-muted-foreground">({pct(v, funnel[i - 1][1])})</span>}</span></div>
                  <div className="mt-1 h-2.5 rounded-full bg-muted"><div className="h-2.5 rounded-full bg-gradient-to-r from-primary to-primary/50" style={{ width: `${Math.max(2, (v / top) * 100)}%` }} /></div>
                </div>
              );
            })}
          </Panel>
          <Panel title="Desempenho por agente" icon={Trophy} className="lg:col-span-2">
            <div className="h-56">
              {bars.length ? (
                <ResponsiveContainer>
                  <BarChart data={bars}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" fontSize={11} stroke="var(--muted-foreground)" />
                    <YAxis fontSize={11} stroke="var(--muted-foreground)" allowDecimals={false} width={28} />
                    <Tooltip {...tip} />
                    <Bar dataKey="abordados" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="responderam" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="grid h-full place-items-center text-sm text-muted-foreground">Nenhum agente abordou ainda.</p>}
            </div>
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border bg-card lg:col-span-2">
            <h2 className="flex items-center gap-2 border-b p-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground"><Trophy className="h-4 w-4 text-primary" />Ranking dos agentes</h2>
            {!d?.agents.length && <p className="p-4 text-sm text-muted-foreground">Nenhum agente ainda.</p>}
            {d?.agents.map((a, i) => (
              <Link key={a.id} to="/agentes/$id" params={{ id: a.id }} className="flex flex-wrap items-center gap-3 border-b p-3 last:border-0 hover:bg-muted/40">
                <span className="w-5 text-center text-sm font-bold text-primary">{i + 1}</span>
                <AgentAvatar id={a.id} name={a.name} url={a.avatar_url} />
                <div className="min-w-[140px] flex-1">
                  <div className="flex items-center gap-2 font-medium">{a.name}<span className={`h-2 w-2 rounded-full ${a.active ? "bg-primary" : "bg-muted-foreground/40"}`} /></div>
                  <div className="text-[11px] text-muted-foreground">{a.squad === "v3" ? "Agentes V3" : a.squad === "agts01" ? "AGTS - 01" : a.squad === "v2" ? "V2" : "Agentes"} · {a.instance || "sem número"}</div>
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
          <Panel title="Atividade recente" icon={Activity}>
            {!d?.events.length && <p className="text-sm text-muted-foreground">Nada por enquanto.</p>}
            <ol className="space-y-3 border-l pl-3">
              {d?.events.map((e, i) => (
                <li key={i} className="relative text-xs">
                  <span className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-primary" />
                  <div className="text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {d.names[e.agent_id] ?? "agente"}</div>
                  <div className="line-clamp-2">{e.text}</div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
