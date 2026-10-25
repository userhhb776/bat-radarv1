import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowUpRight, Wallet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ProposalDialog } from "@/components/ProposalDialog";
import { Button } from "@/components/ui/button";
import { leadsKey, listLeads, type SavedLead } from "@/lib/leads";
import { listProposals, proposalsKey } from "@/lib/proposals";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({ meta: [
    { title: "Clientes fechados — BatRadar 5.7" }, { name: "description", content: "Acompanhe entregas, propostas, recebimentos, custos e resultados dos clientes fechados." },
    { property: "og:title", content: "Clientes fechados — BatRadar 5.7" }, { property: "og:description", content: "Acompanhe os resultados dos negócios fechados." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: ClientesPage,
});
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ClientesPage() {
  const { data: allLeads = [], isLoading: loadingLeads, isError: leadError } = useQuery({ queryKey: leadsKey, queryFn: listLeads });
  const leads = allLeads.filter((l) => !l.source || l.source === "batradar");
  const { data: proposals = [], isLoading: loadingProposals, isError: proposalError } = useQuery({ queryKey: proposalsKey, queryFn: listProposals });
  const [selected, setSelected] = useState<SavedLead | null>(null);
  const closed = leads.filter((l) => l.status === "fechado");
  const closedIds = new Set(closed.map((l) => l.id));
  const recorded = proposals.filter((p) => closedIds.has(p.lead_id));
  const proposed = recorded.reduce((sum, p) => sum + p.amount, 0);
  const received = recorded.reduce((sum, p) => sum + p.received_amount, 0);
  const costs = recorded.reduce((sum, p) => sum + p.project_cost, 0);
  const roi = costs > 0 ? ((received - costs) / costs) * 100 : null;
  return <AppShell>
    <p className="text-xs font-semibold uppercase text-primary">Resultados / 02</p><h1 className="text-3xl font-bold">Clientes fechados</h1>
    <p className="mt-1 text-sm text-muted-foreground">Entregas e retorno financeiro dos negócios marcados como Fechado no pipeline.</p>
    <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[{ label: "Clientes", value: String(closed.length) }, { label: "Propostas fechadas", value: money(proposed) }, { label: "Recebido", value: money(received) }, { label: "Retorno sobre custos", value: roi === null ? "—" : `${roi.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` }].map((item) => <div key={item.label} className="border-t border-primary/40 pt-4"><p className="text-xs uppercase text-muted-foreground">{item.label}</p><p className="mt-2 text-2xl font-semibold text-primary">{item.value}</p></div>)}
    </div>
    <p className="mt-3 text-xs text-muted-foreground">Retorno = (valor recebido − custos registrados) ÷ custos registrados. Sem custos informados, não há percentual; não inclui despesas gerais do BatRadar.</p>
    {(loadingLeads || loadingProposals) && <p className="mt-10 text-muted-foreground">Carregando clientes...</p>}
    {(leadError || proposalError) && <p className="mt-10 text-destructive">Não foi possível carregar os clientes. Atualize a página para tentar novamente.</p>}
    {!loadingLeads && !leadError && closed.length === 0 && <p className="mt-10 text-muted-foreground">Nenhum cliente fechado ainda. Marque uma empresa como Fechado no <Link to="/pipeline" className="text-primary underline">pipeline</Link>.</p>}
    <div className="mt-8 grid gap-4 md:grid-cols-2">
      {closed.map((lead) => { const p = proposals.find((item) => item.lead_id === lead.id); const individualRoi = p && p.project_cost > 0 ? ((p.received_amount - p.project_cost) / p.project_cost) * 100 : null;
        return <article key={lead.id} className="min-w-0 rounded-md border bg-card p-5 sm:p-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3"><div className="min-w-0"><p className="text-xs uppercase text-primary">Cliente fechado</p><h2 className="mt-1 break-words text-xl font-semibold">{lead.name}</h2><p className="mt-1 text-sm text-muted-foreground">{lead.niche || lead.city || "Empresa local"}</p></div><Wallet className="h-5 w-5 shrink-0 text-primary" /></div>
          <div className="mt-5 grid grid-cols-2 gap-4 border-y py-4 text-sm"><div><p className="text-muted-foreground">Proposta</p><p className="mt-1 font-semibold">{p ? money(p.amount) : "Não registrada"}</p></div><div><p className="text-muted-foreground">Retorno sobre custos</p><p className="mt-1 font-semibold">{individualRoi === null ? "—" : `${individualRoi.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}</p></div><div><p className="text-muted-foreground">Recebido</p><p className="mt-1">{money(p?.received_amount ?? 0)}</p></div><div><p className="text-muted-foreground">Custos</p><p className="mt-1">{money(p?.project_cost ?? 0)}</p></div></div>
          <div className="mt-5 space-y-4 text-sm"><div><p className="font-medium">O que foi feito</p><p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{p?.completed_work || "Ainda não registrado"}</p></div><div><p className="font-medium">Resultado</p><p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{p?.outcome || "Ainda não registrado"}</p></div></div>
          <Button variant="outline" className="mt-5 w-full" onClick={() => setSelected(lead)}>{p ? "Atualizar acompanhamento" : "Registrar proposta e resultado"}<ArrowUpRight className="ml-2 h-4 w-4" /></Button>
        </article>;
      })}
    </div>
    <ProposalDialog lead={selected} proposal={proposals.find((p) => p.lead_id === selected?.id)} onClose={() => setSelected(null)} />
  </AppShell>;
}