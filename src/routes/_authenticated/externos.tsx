import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Instagram, MapPin, MessageCircle, Plus, Search, Trash2 } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { LeadDialog } from "@/components/LeadDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addExternalLeads, deleteLead, leadsKey, listLeads, toPlaceLead, updateLead, type SavedLead } from "@/lib/leads";
import { STATUSES, type LeadStatus } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/externos")({
  head: () => ({ meta: [
    { title: "Leads externos — BatRadar 5.7" }, { name: "description", content: "Organize empresas encontradas fora do BatRadar com seus links e contatos." },
    { property: "og:title", content: "Leads externos — BatRadar 5.7" }, { property: "og:description", content: "Guarde links e contatos dos seus leads externos." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: ExternosPage,
});

const empty = { name: "", instagram: "", phone: "", source_url: "", maps_url: "" };
const webLink = z.string().trim().url().max(1000).refine((url) => /^https?:\/\//i.test(url));
const schema = z.object({
  name: z.string().trim().max(200),
  instagram: z.string().trim().max(200),
  phone: z.string().trim().max(40),
  source_url: webLink,
  maps_url: z.union([z.literal(""), webLink]),
});

function ExternosPage() {
  const qc = useQueryClient();
  const { data: all = [], isLoading } = useQuery({ queryKey: leadsKey, queryFn: listLeads });
  const leads = all.filter((l) => l.source && l.source !== "batradar");
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<SavedLead | null>(null);
  const shown = leads.filter((l) => !q.trim() || [l.name, l.phone, l.instagram, l.source_url].some((x) => x?.toLocaleLowerCase("pt-BR").includes(q.trim().toLocaleLowerCase("pt-BR"))));
  const refresh = () => qc.invalidateQueries({ queryKey: leadsKey });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(f);
    if (!parsed.success) { toast.error("Informe um link de origem válido, começando com https://"); return; }
    setBusy(true);
    try {
      const values = parsed.data;
      await addExternalLeads([{
        name: values.name || new URL(values.source_url).hostname.replace(/^www\./, ""),
        instagram: values.instagram,
        phone: values.phone,
        source_url: values.source_url,
        maps_url: values.maps_url,
      }]);
      toast.success("Lead adicionado ao Pipeline e ao CRM");
      setF(empty);
      await refresh();
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm("Remover este lead?")) return;
    try { await deleteLead(id); await refresh(); toast.success("Lead removido"); }
    catch (err) { toast.error((err as Error).message); }
  }

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">Leads externos</h1>
      <p className="mt-1 text-sm text-muted-foreground">Empresas encontradas fora do BatRadar, junto das demais no Pipeline e no CRM.</p>

      <div className="mt-6 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <form onSubmit={add} className="min-w-0 space-y-3 self-start">
          <h2 className="font-display font-semibold">Adicionar lead</h2>
          <label className="block text-sm" htmlFor="external-source">Link de origem <span className="text-primary">*</span></label>
          <Input id="external-source" type="url" required placeholder="https://onde-encontrei-a-loja.com/..." value={f.source_url} onChange={(e) => setF({ ...f, source_url: e.target.value })} maxLength={1000} />
          <label className="block text-sm" htmlFor="external-name">Nome da empresa</label>
          <Input id="external-name" placeholder="Nome da empresa (opcional)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={200} />
          <label className="block text-sm" htmlFor="external-instagram">Instagram</label>
          <Input id="external-instagram" placeholder="@empresa ou link do perfil" value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} maxLength={200} />
          <label className="block text-sm" htmlFor="external-phone">Contato do WhatsApp</label>
          <Input id="external-phone" type="tel" placeholder="(11) 99999-9999" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} maxLength={40} />
          <label className="block text-sm" htmlFor="external-maps">Link do Google Maps (opcional)</label>
          <Input id="external-maps" type="url" placeholder="https://maps.google.com/..." value={f.maps_url} onChange={(e) => setF({ ...f, maps_url: e.target.value })} maxLength={1000} />
          <Button type="submit" disabled={busy} className="w-full"><Plus className="mr-2 h-4 w-4" />{busy ? "Salvando..." : "Adicionar lead"}</Button>
        </form>

        <section className="min-w-0">
          <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" aria-label="Buscar leads externos" placeholder="Buscar empresa, link ou contato" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{shown.length} de {leads.length} leads externos</p>
          {isLoading ? <p className="mt-6 text-sm text-muted-foreground">Carregando...</p> : shown.length === 0 ? (
            <p className="mt-4 border-t py-8 text-center text-sm text-muted-foreground">{q ? "Nenhum lead encontrado." : "Nenhum lead externo ainda."}</p>
          ) : (
            <div className="mt-3 grid gap-3">
              {shown.map((l) => (
                <article key={l.id} className="min-w-0 rounded-md border bg-card p-4">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <Button variant="ghost" className="h-auto min-w-0 justify-start p-0 text-left font-semibold whitespace-normal hover:bg-transparent" onClick={() => setOpen(l)}>{l.name}</Button>
                    <Button size="icon" variant="ghost" aria-label={`Remover ${l.name}`} onClick={() => remove(l.id)} className="shrink-0 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {l.source_url && <a href={l.source_url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2 text-primary hover:underline"><ExternalLink className="h-4 w-4 shrink-0" /><span className="truncate">Link de origem</span></a>}
                    {l.instagram && <p className="flex min-w-0 items-center gap-2"><Instagram className="h-4 w-4 shrink-0" /><span className="truncate">{l.instagram}</span></p>}
                    {l.phone && <p className="flex min-w-0 items-center gap-2"><MessageCircle className="h-4 w-4 shrink-0" /><span className="truncate">{l.phone}</span></p>}
                    {l.maps_url && <a href={l.maps_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline"><MapPin className="h-4 w-4 shrink-0" />Google Maps</a>}
                  </div>
                  <div className="mt-3 flex min-w-0 items-center gap-2 border-t pt-3">
                    <Select value={l.status} onValueChange={async (v) => { try { await updateLead(l.id, { status: v as LeadStatus }); await refresh(); } catch { toast.error("Não foi possível alterar o status"); } }}>
                      <SelectTrigger className="h-9 min-w-0 flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" onClick={() => setOpen(l)}>Abrir</Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
      <LeadDialog lead={open ? toPlaceLead(open) : null} saved={open ? all.find((l) => l.id === open.id) ?? open : null} onClose={() => setOpen(null)} />
    </AppShell>
  );
}