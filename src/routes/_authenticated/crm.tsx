import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, ExternalLink, MessageCircle, Phone, Search } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { leadsKey, listLeads, updateLead, type SavedLead } from "@/lib/leads";
import { listProposals, proposalsKey, type Proposal } from "@/lib/proposals";
import { listScripts, scriptsKey, type Script } from "@/lib/scripts";
import { STATUSES, whatsappLink, type LeadStatus } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({ meta: [
    { title: "CRM — BatRadar 5.7" }, { name: "description", content: "Todas as empresas, cotações, retornos e sites entregues em um só lugar." },
    { property: "og:title", content: "CRM — BatRadar 5.7" }, { property: "og:description", content: "Acompanhe empresas, retornos e sites entregues." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: CrmPage,
});

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const urlSchema = z.string().trim().url().max(500).refine((u) => /^https?:\/\//i.test(u));
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d: string) => new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("pt-BR");

type View = "todos" | "retorno" | "sem_contato" | "concluidos" | LeadStatus;

function CrmPage() {
  const { data: all = [], isLoading } = useQuery({ queryKey: leadsKey, queryFn: listLeads });
  const leads = all.filter((l) => !l.source || l.source === "batradar");
  const { data: proposals = [] } = useQuery({ queryKey: proposalsKey, queryFn: listProposals });
  const { data: scripts = [] } = useQuery({ queryKey: scriptsKey, queryFn: listScripts });
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("todos");
  const t = today();

  const stats = useMemo(() => {
    const open = leads.filter((l) => l.status !== "fechado" && l.status !== "perdido");
    const quoted = proposals.filter((p) => open.some((l) => l.id === p.lead_id)).reduce((s, p) => s + Number(p.amount), 0);
    return {
      done: leads.filter((l) => l.delivered_site_url).length,
      due: leads.filter((l) => l.next_followup_at && l.next_followup_at <= t).length,
      noContact: leads.filter((l) => !l.last_contact_at && l.status === "novo").length,
      quoted,
    };
  }, [leads, proposals, t]);

  const shown = leads.filter((l) => {
    const s = q.trim().toLowerCase();
    if (s && ![l.name, l.niche, l.city, l.phone].some((x) => x?.toLowerCase().includes(s))) return false;
    if (view === "todos") return true;
    if (view === "retorno") return !!l.next_followup_at && l.next_followup_at <= t;
    if (view === "sem_contato") return !l.last_contact_at && l.status === "novo";
    if (view === "concluidos") return !!l.delivered_site_url;
    return l.status === view;
  }).sort((a, b) => (a.next_followup_at ?? "9999").localeCompare(b.next_followup_at ?? "9999"));

  return <AppShell>
    <p className="text-xs font-semibold uppercase text-primary">Relacionamento</p>
    <h1 className="text-3xl font-bold">CRM</h1>
    <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Empresas" value={String(leads.length)} />
      <Stat label="Retornos para hoje" value={String(stats.due)} highlight={stats.due > 0} />
      <Stat label="Em negociação (cotado)" value={money(stats.quoted)} />
      <Stat label="Sites entregues" value={String(stats.done)} />
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_14rem]">
      <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, nicho, cidade ou telefone" /></div>
      <Select value={view} onValueChange={(v) => setView(v as View)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todas</SelectItem>
          <SelectItem value="retorno">Retorno vencido / hoje</SelectItem>
          <SelectItem value="sem_contato">Nunca contatadas ({stats.noContact})</SelectItem>
          <SelectItem value="concluidos">Sites entregues</SelectItem>
          {STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
    {isLoading && <p className="mt-8 text-muted-foreground">Carregando...</p>}
    {!isLoading && shown.length === 0 && <p className="mt-6 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma empresa neste filtro.</p>}
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      {shown.map((l) => <CrmCard key={l.id} lead={l} proposal={proposals.find((p) => p.lead_id === l.id)} scripts={scripts} />)}
    </div>
  </AppShell>;
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return <div className={`min-w-0 rounded-md border bg-card p-3 ${highlight ? "border-primary" : ""}`}>
    <p className="text-xs text-muted-foreground">{label}</p><p className="truncate text-lg font-bold">{value}</p>
  </div>;
}

function CrmCard({ lead, proposal, scripts }: { lead: SavedLead; proposal: Proposal | undefined; scripts: Script[] }) {
  const qc = useQueryClient();
  const [url, setUrl] = useState(lead.delivered_site_url ?? "");
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: leadsKey });

  async function patch(p: Parameters<typeof updateLead>[1], msg?: string) {
    try { await updateLead(lead.id, p); await refresh(); if (msg) toast.success(msg); } catch { toast.error("Não foi possível salvar"); }
  }
  async function save() {
    const parsed = urlSchema.safeParse(url);
    if (!parsed.success) { toast.error("Informe um link válido, começando com https://"); return; }
    setBusy(true);
    await patch({ delivered_site_url: parsed.data, delivered_at: new Date().toISOString(), status: "fechado" }, "Site registrado — empresa concluída no pipeline");
    setBusy(false);
  }
  function whatsapp() {
    const link = whatsappLink(lead.phone, lead.message ?? `Oi! Tudo bem? Aqui é sobre a ${lead.name}.`);
    if (!link) { toast.error("Sem telefone cadastrado"); return; }
    window.open(link, "_blank", "noopener");
    patch({ last_contact_at: new Date().toISOString() });
  }
  const overdue = lead.next_followup_at && lead.next_followup_at <= today();
  const script = scripts.find((s) => s.id === lead.script_id);

  return <article className="min-w-0 rounded-md border bg-card p-4 sm:p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="break-words text-lg font-semibold">{lead.name}</h2><p className="text-sm text-muted-foreground">{[lead.niche, lead.city].filter(Boolean).join(" · ") || "Empresa local"}</p></div>
      {lead.delivered_site_url && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-1 text-xs font-medium text-primary"><CheckCircle2 className="h-3.5 w-3.5" />Concluído</span>}
    </div>
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{lead.phone}</span>}
      <span>Último contato: {lead.last_contact_at ? fmtDate(lead.last_contact_at) : "nunca"}</span>
      {script && <span>Script: {script.title}</span>}
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <Select value={lead.status} onValueChange={(v) => patch({ status: v as LeadStatus }, "Status atualizado")}>
        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
      </Select>
      <Button size="sm" className="h-9 bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90" onClick={whatsapp} disabled={!lead.phone}><MessageCircle className="h-4 w-4" />WhatsApp</Button>
    </div>
    <label className={`mt-3 flex items-center gap-2 text-sm ${overdue ? "font-semibold text-primary" : ""}`}>
      <CalendarClock className="h-4 w-4 shrink-0" /> Próximo retorno
      <Input type="date" className="ml-auto h-8 w-40" value={lead.next_followup_at ?? ""} onChange={(e) => patch({ next_followup_at: e.target.value || null }, e.target.value ? "Retorno agendado" : "Retorno removido")} />
    </label>
    <div className="mt-3 grid grid-cols-2 gap-3 border-y py-3 text-sm">
      <div><p className="text-muted-foreground">Valor da cotação</p><p className="font-semibold">{proposal ? money(Number(proposal.amount)) : "Sem cotação"}</p></div>
      <div><p className="text-muted-foreground">Prazo</p><p className="font-semibold">{proposal?.deadline || "—"}</p></div>
    </div>
    <Textarea className="mt-3" rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (lead.notes ?? "") && patch({ notes }, "Anotação salva")} placeholder="Anotações (salva ao sair do campo)" />
    <label className="mt-3 block text-sm font-medium" htmlFor={`site-${lead.id}`}>Link do site entregue</label>
    <div className="mt-1 flex flex-col gap-2 sm:flex-row">
      <Input id={`site-${lead.id}`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://empresa.com.br" maxLength={500} />
      <Button onClick={save} disabled={busy} className="shrink-0">{busy ? "Salvando..." : "Marcar concluído"}</Button>
    </div>
    {lead.delivered_site_url && <a href={lead.delivered_site_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-primary underline">Abrir site <ExternalLink className="h-3.5 w-3.5" /></a>}
  </article>;
}
