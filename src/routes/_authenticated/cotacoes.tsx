import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FilePenLine, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ProposalDialog } from "@/components/ProposalDialog";
import { Button } from "@/components/ui/button";
import { leadsKey, listLeads, type SavedLead } from "@/lib/leads";
import { listProposals, proposalsKey } from "@/lib/proposals";

export const Route = createFileRoute("/_authenticated/cotacoes")({
  head: () => ({ meta: [
    { title: "Cotações — BatRadar 5.7" }, { name: "description", content: "Monte propostas com valor, prazo e forma de pagamento para empresas do pipeline." },
    { property: "og:title", content: "Cotações — BatRadar 5.7" }, { property: "og:description", content: "Propostas para empresas do seu pipeline." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: CotacoesPage,
});
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function CotacoesPage() {
  const { data: allLeads = [], isLoading: loadingLeads, isError: leadError } = useQuery({ queryKey: leadsKey, queryFn: listLeads });
  const leads = allLeads.filter((l) => !l.source || l.source === "batradar");
  const { data: proposals = [], isLoading: loadingProposals, isError: proposalError } = useQuery({ queryKey: proposalsKey, queryFn: listProposals });
  const [selected, setSelected] = useState<SavedLead | null>(null);
  const [selectedId, setSelectedId] = useState("");
  return <AppShell>
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
      <div className="min-w-0"><p className="text-xs font-semibold uppercase text-primary">Comercial / 01</p><h1 className="text-3xl font-bold">Cotações</h1><p className="mt-1 text-sm text-muted-foreground">Uma proposta por empresa salva no pipeline.</p></div>
      <span className="shrink-0 text-sm text-muted-foreground">{proposals.length} propostas</span>
    </div>
    <div className="mt-7 grid gap-3 border-y py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <label className="min-w-0 space-y-2 text-sm font-medium">Escolha uma empresa do pipeline
        <select aria-label="Empresa do pipeline" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-foreground">
          <option value="">Selecione uma empresa</option>{leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </label>
      <Button disabled={!selectedId} onClick={() => setSelected(leads.find((l) => l.id === selectedId) ?? null)}><Plus className="mr-2 h-4 w-4" /> Montar proposta</Button>
    </div>
    {(loadingLeads || loadingProposals) && <p className="mt-8 text-muted-foreground">Carregando propostas...</p>}
    {(leadError || proposalError) && <p className="mt-8 text-destructive">Não foi possível carregar as propostas. Atualize a página para tentar novamente.</p>}
    {!loadingLeads && !loadingProposals && !leadError && !proposalError && leads.length === 0 && <p className="mt-10 text-muted-foreground">Nenhuma empresa salva. <Link to="/pipeline" className="text-primary underline">Veja o pipeline</Link> ou busque uma empresa para começar.</p>}
    {!loadingProposals && proposals.length === 0 && leads.length > 0 && <p className="mt-10 text-muted-foreground">Nenhuma proposta ainda. Escolha uma empresa acima para montar a primeira.</p>}
    <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {proposals.map((p) => { const lead = leads.find((l) => l.id === p.lead_id); if (!lead) return null; return <article key={p.id} className="min-w-0 rounded-md border bg-card p-5">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs uppercase text-primary">{lead.status === "fechado" ? "Cliente fechado" : "Em negociação"}</p><h2 className="mt-1 break-words text-lg font-semibold">{lead.name}</h2></div><FilePenLine className="h-5 w-5 shrink-0 text-primary" /></div>
        <p className="mt-4 text-2xl font-semibold text-primary">{money(p.amount)}</p>
        <dl className="mt-4 space-y-2 text-sm"><div><dt className="text-muted-foreground">Prazo</dt><dd className="break-words">{p.deadline || "Não informado"}</dd></div><div><dt className="text-muted-foreground">Pagamento</dt><dd className="break-words">{p.payment_terms || "Não informado"}</dd></div></dl>
        {p.scope && <p className="mt-4 whitespace-pre-wrap break-words border-t pt-3 text-sm text-muted-foreground">{p.scope}</p>}
        <Button className="mt-5 w-full" variant="outline" onClick={() => setSelected(lead)}>Editar proposta</Button>
      </article>; })}
    </div>
    <ProposalDialog lead={selected} proposal={proposals.find((p) => p.lead_id === selected?.id)} onClose={() => setSelected(null)} />
  </AppShell>;
}