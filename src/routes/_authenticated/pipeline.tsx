import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Trash2, Star, GlobeLock, FilePenLine } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LeadDialog } from "@/components/LeadDialog";
import { SaveToBlock } from "@/components/SaveToBlock";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { deleteLead, leadsKey, listLeads, toPlaceLead, updateLead, type SavedLead } from "@/lib/leads";
import { STATUSES, type LeadStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ProposalDialog } from "@/components/ProposalDialog";
import { listProposals, proposalsKey } from "@/lib/proposals";
import { useSearchAudit } from "@/hooks/use-search-audit";

export const Route = createFileRoute("/_authenticated/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline — BatRadar 5.7" },
      { name: "description", content: "Gerencie seus leads do primeiro contato ao fechamento." },
      { property: "og:title", content: "Pipeline — BatRadar 5.7" },
      { property: "og:description", content: "Mini-CRM de prospecção local." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PipelinePage,
});

const dot: Record<LeadStatus, string> = {
  novo: "bg-cold",
  enviada: "bg-warm",
  respondeu: "bg-accent",
  reuniao: "bg-primary",
  fechado: "bg-whatsapp",
  perdido: "bg-destructive",
};

function PipelinePage() {
  const qc = useQueryClient();
  const { data: all = [], isLoading } = useQuery({ queryKey: leadsKey, queryFn: listLeads });
  const [query, setQuery] = useState("");
  useSearchAudit(query, "/pipeline");
  const filteredAll = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    if (!q) return all;
    return all.filter((l) => {
      const inName = (l.name ?? "").toLowerCase().includes(q);
      const inPhone = digits.length >= 3 && (l.phone ?? "").replace(/\D/g, "").includes(digits);
      return inName || inPhone;
    });
  }, [all, query]);
  const leads = filteredAll.filter((l) => !l.source || l.source === "batradar");
  const { data: proposals = [] } = useQuery({ queryKey: proposalsKey, queryFn: listProposals });
  const [open, setOpen] = useState<SavedLead | null>(null);
  const [quote, setQuote] = useState<SavedLead | null>(null);

  async function move(id: string, status: LeadStatus) {
    await updateLead(id, { status });
    qc.invalidateQueries({ queryKey: leadsKey });
  }
  async function remove(id: string) {
    if (!confirm("Remover este lead?")) return;
    await deleteLead(id);
    qc.invalidateQueries({ queryKey: leadsKey });
    toast.success("Lead removido");
  }

  const fechados = leads.filter((l) => l.status === "fechado").length;

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Pipeline</h1>
          <p className="mt-1 text-muted-foreground">{leads.length} leads · {fechados} fechados</p>
        </div>
        <SaveToBlock leads={leads.filter((l) => l.status === "novo").map(toPlaceLead)} />
      </div>

      <div className="mt-5 relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome ou telefone…"
          className="pl-9"
          aria-label="Buscar lead no pipeline"
        />
      </div>

      {!isLoading && leads.length === 0 && query.trim() && all.length > 0 && (
        <div className="mt-10 rounded-lg border border-dashed p-6 text-center text-muted-foreground sm:p-12">
          Nenhum lead encontrado para "{query.trim()}".
        </div>
      )}
      {!isLoading && all.length === 0 && (
         <div className="mt-10 rounded-lg border border-dashed p-6 text-center text-muted-foreground sm:p-12">
          Nenhum lead salvo ainda. <Link to="/buscar" className="font-medium text-primary underline">Buscar empresas</Link>
        </div>
      )}

      {leads.length > 0 && (
         <div className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {STATUSES.map((s) => {
            const col = leads.filter((l) => l.status === s.id);
            return (
               <div key={s.id} className="min-w-0 rounded-lg bg-muted/70 p-3">
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className={`h-2.5 w-2.5 rounded-full ${dot[s.id]}`} />
                  <h2 className="text-sm font-semibold">{s.label}</h2>
                  <span className="ml-auto text-xs text-muted-foreground">{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map((l) => (
                     <div key={l.id} className="min-w-0 rounded-lg border bg-card p-3 shadow-sm">
                       <Button variant="ghost" className="h-auto w-full min-w-0 flex-col items-start gap-0 whitespace-normal px-0 py-1 text-left hover:bg-transparent" onClick={() => setOpen(l)}>
                         <p className="break-words font-medium leading-snug">{l.name}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Star className="h-3 w-3 fill-warm text-warm" /> {l.rating ?? "—"} · {l.reviews_count ?? 0}
                          {!l.website && <span className="ml-1 inline-flex items-center gap-0.5 text-hot"><GlobeLock className="h-3 w-3" /> sem site</span>}
                        </p>
                        {l.niche && <p className="mt-1 truncate text-xs text-muted-foreground">{l.niche}</p>}
                        {l.delivered_site_url && (() => { const p = proposals.find((x) => x.lead_id === l.id); return (
                          <p className="mt-2 rounded bg-primary/15 px-2 py-1 text-xs font-medium text-primary">
                            ✓ Concluído{p ? ` · ${p.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}${p.deadline ? ` · ${p.deadline}` : ""}` : ""}
                          </p>); })()}
                       </Button>
                      <div className="mt-2 flex items-center gap-1">
                        <Select value={l.status} onValueChange={(v) => move(l.id, v as LeadStatus)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((x) => <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                         <Button variant="ghost" size="icon" onClick={() => remove(l.id)} className="shrink-0 text-muted-foreground hover:text-destructive" title="Remover" aria-label="Remover lead">
                          <Trash2 className="h-4 w-4" />
                         </Button>
                      </div>
                      <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => setQuote(l)}><FilePenLine className="mr-2 h-3.5 w-3.5" />{proposals.some((p) => p.lead_id === l.id) ? "Ver proposta" : "Montar proposta"}</Button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <LeadDialog
        lead={open ? toPlaceLead(open) : null}
        saved={open ? leads.find((l) => l.id === open.id) ?? open : null}
        onClose={() => setOpen(null)}
      />
      <ProposalDialog lead={quote} proposal={proposals.find((p) => p.lead_id === quote?.id)} onClose={() => setQuote(null)} />
    </AppShell>
  );
}
