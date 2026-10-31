import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowRight, Bot, CalendarClock, Contact, Gauge, KanbanSquare, Layers, Megaphone, MessageCircle, Search, Sunrise, Users, BookOpen, Inbox, ScrollText, Crosshair, FilePenLine, Brain, Send, MessagesSquare, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getAccountAccess } from "@/lib/access.functions";
import { leadsKey, listLeads } from "@/lib/leads";
import { STATUSES } from "@/lib/types";
import { pingActivity } from "@/lib/push-client";
import logo from "@/assets/batradar-logo.png";

const leadOptions = queryOptions({ queryKey: leadsKey, queryFn: listLeads, staleTime: 60_000 });

export const Route = createFileRoute("/_authenticated/teste")({
  head: () => ({ meta: [
    { title: "Visão geral — BatRadar · Teste" },
    { name: "description", content: "Uma visão simplificada dos seus leads e atalhos de trabalho no BatRadar." },
    { property: "og:title", content: "Visão geral — BatRadar · Teste" },
    { property: "og:description", content: "Leads, campanhas e vendas organizados em um só lugar." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(leadOptions),
  component: TestDashboard,
  errorComponent: ({ reset }) => <div className="mx-auto max-w-lg px-5 py-20 text-center"><h1 className="text-2xl">Não foi possível carregar seus leads</h1><div className="mt-6 flex justify-center gap-3"><Button onClick={reset}><RefreshCw />Tentar novamente</Button><Button asChild variant="outline"><Link to="/buscar">Painel atual</Link></Button></div></div>,
});

const workspaces = [
  { id: "buscar", label: "Encontrar", items: [
    { title: "Buscar empresas", path: "/buscar", icon: Search },
    { title: "Leads do dia", path: "/diarios", icon: Sunrise },
    { title: "Leads externos", path: "/externos", icon: Inbox },
    { title: "Comparar empresas", path: "/comparar", icon: Crosshair },
  ] },
  { id: "enviar", label: "Conversar", items: [
    { title: "Campanhas", path: "/campanhas", icon: Megaphone },
    { title: "WhatsApp", path: "/whatsapp", icon: MessageCircle },
    { title: "Agendamentos", path: "/agendamentos", icon: CalendarClock },
    { title: "Blocos de leads", path: "/blocos", icon: Layers },
    { title: "Scripts", path: "/scripts", icon: ScrollText },
  ] },
  { id: "vender", label: "Vender", items: [
    { title: "Pipeline", path: "/pipeline", icon: KanbanSquare },
    { title: "CRM", path: "/crm", icon: Contact },
    { title: "Cotações", path: "/cotacoes", icon: FilePenLine },
  ] },
  { id: "mais", label: "Mais", items: [
    { title: "Papa Lead · Contatos", path: "/papa-lead", icon: Users },
    { title: "Papa Lead · Mensagens", path: "/papa-lead-mensagens", icon: MessagesSquare },
    { title: "Papa Lead · Campanhas", path: "/papa-lead-campanhas", icon: Send },
    { title: "Aprendizado", path: "/aprendizado", icon: Brain },
    { title: "Manual", path: "/manual", icon: BookOpen },
  ] },
] as const;

function TestDashboard() {
  const { data: leads } = useSuspenseQuery(leadOptions);
  const accessFn = useServerFn(getAccountAccess);
  const access = useQuery({ queryKey: ["account-access"], queryFn: () => accessFn(), staleTime: 30_000 });
  const [showAll, setShowAll] = useState(false);
  const recent = showAll ? leads.slice(0, 12) : leads.slice(0, 4);
  const metrics = [
    { label: "Leads salvos", value: leads.length, color: "text-foreground" },
    { label: "Responderam", value: leads.filter(l => l.status === "respondeu").length, color: "text-primary" },
    { label: "Fechados", value: leads.filter(l => l.status === "fechado").length, color: "text-whatsapp" },
  ];
  return (
    <div className="min-h-screen bg-background" onPointerDown={() => { void pingActivity(); }}>
      <header className="border-b bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link to="/teste" className="flex min-w-0 items-center gap-2.5">
            <img src={logo} alt="" className="h-9 w-9 object-contain" width={1024} height={1024} />
            <span className="font-display text-xl font-semibold">BatRadar</span>
            <span className="text-xs text-muted-foreground">Teste</span>
          </Link>
          <Button asChild variant="ghost" size="sm"><Link to="/buscar">Painel atual <ArrowRight /></Link></Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-10 pt-8 sm:px-8 sm:pt-12">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div><p className="text-sm text-muted-foreground">Seu espaço de trabalho</p><h1 className="mt-2 font-display text-3xl font-semibold tracking-normal sm:text-4xl">Visão geral</h1></div>
          <Button asChild variant="outline"><Link to="/argos"><Bot />Falar com Argos</Link></Button>
        </div>

        <section aria-label="Resumo dos leads" className="my-8 grid grid-cols-3 divide-x border-y py-5 sm:my-10 sm:py-6">
          {metrics.map(m => <div key={m.label} className="px-2 text-center first:pl-0 last:pr-0 sm:px-6 sm:text-left"><p className={`font-display text-3xl font-semibold ${m.color}`}>{m.value.toLocaleString("pt-BR")}</p><p className="mt-1 text-xs text-muted-foreground sm:text-sm">{m.label}</p></div>)}
        </section>

        <section aria-label="Áreas de trabalho">
          <Tabs defaultValue="buscar">
            <TabsList className="grid h-11 w-full grid-cols-4 sm:max-w-md">
              {workspaces.map(w => <TabsTrigger key={w.id} value={w.id} className="min-w-0 px-1 text-xs sm:text-sm">{w.label}</TabsTrigger>)}
            </TabsList>
            {workspaces.map(w => <TabsContent key={w.id} value={w.id} className="mt-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {w.items.map((item, i) => <Button key={item.path} asChild variant="ghost" className={`h-auto min-h-16 justify-start whitespace-normal rounded-lg border p-4 text-left ${i === 0 ? "border-primary/30 bg-primary/5" : "bg-card"}`}>
                  <Link to={item.path}><item.icon className={i === 0 ? "text-primary" : "text-muted-foreground"} /><span className="min-w-0 flex-1">{item.title}</span><ArrowRight className="text-muted-foreground" /></Link>
                </Button>)}
              </div>
            </TabsContent>)}
          </Tabs>
        </section>

        <section className="mt-10 sm:mt-12" aria-labelledby="recent-heading">
          <div className="mb-3 flex items-center justify-between gap-3"><h2 id="recent-heading" className="font-display text-xl font-semibold tracking-normal">Últimos leads</h2><Button asChild variant="link" size="sm"><Link to="/pipeline">Ver pipeline <ArrowRight /></Link></Button></div>
          {recent.length === 0 ? <div className="border-y py-8"><p className="text-sm text-muted-foreground">Nenhum lead salvo ainda.</p><Button asChild className="mt-4"><Link to="/buscar"><Search />Buscar empresas</Link></Button></div> : <div className="divide-y border-y">
            {recent.map(l => <Link key={l.id} to="/pipeline" className="flex min-w-0 items-center justify-between gap-3 py-4 transition-colors hover:bg-muted/40">
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{l.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{l.city || l.address || "Local não informado"}</p></div>
              <span className="max-w-28 shrink-0 text-right text-xs text-muted-foreground">{STATUSES.find(s => s.id === l.status)?.label ?? l.status}</span>
            </Link>)}
          </div>}
          {leads.length > 4 && <Button variant="ghost" size="sm" className="mt-3" onClick={() => setShowAll(v => !v)}>{showAll ? "Mostrar menos" : "Mostrar mais"}</Button>}
        </section>

        {access.data?.admin && <nav aria-label="Administração" className="mt-8 flex flex-wrap gap-2 border-t pt-5"><Button asChild variant="ghost" size="sm"><Link to="/acess"><Contact />Acessos e aprovação</Link></Button><Button asChild variant="ghost" size="sm"><Link to="/sistema"><Gauge />Sistema</Link></Button></nav>}
      </main>
    </div>
  );
}