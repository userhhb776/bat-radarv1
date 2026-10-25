import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle, Save, ExternalLink, Copy, ScrollText, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { leadsKey, saveLead, updateLead, type SavedLead } from "@/lib/leads";
import { fillScript, listScripts, scriptMatches, scriptsKey } from "@/lib/scripts";
import { STATUSES, whatsappLink, type Audit, type LeadStatus, type PlaceLead } from "@/lib/types";
import { formatBR, normalizeBR } from "@/lib/phone";
import { OpportunityBadge } from "./LeadCard";
import { SaveToBlock } from "./SaveToBlock";
import { ScheduleSend } from "./ScheduleSend";

type Props = {
  lead: PlaceLead | null;
  saved?: SavedLead | null;
  niche?: string | undefined;
  city?: string | undefined;
  onClose: () => void;
};

export function LeadDialog({ lead, saved, niche, city, onClose }: Props) {
  const qc = useQueryClient();
  const { data: scripts = [] } = useQuery({ queryKey: scriptsKey, queryFn: listScripts });
  const [audit, setAudit] = useState<Audit | null>(null);
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"audit" | "msg" | "save" | null>(null);
  const [current, setCurrent] = useState<SavedLead | null>(null);
  const [scriptId, setScriptId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");

  useEffect(() => {
    setAudit(saved?.audit ?? null);
    setMessage(saved?.message ?? "");
    setNotes(saved?.notes ?? "");
    setCurrent(saved ?? null);
    setScriptId(saved?.script_id ?? null);
    setPhone(lead?.intlPhone ?? lead?.phone ?? "");
    // só reinicia ao abrir outra empresa; atualizações da lista não apagam o que está sendo digitado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.placeId, saved?.id]);

  if (!lead) return null;
  const normPhone = normalizeBR(phone);
  const eff: PlaceLead = phone !== (lead.intlPhone ?? lead.phone ?? "") ? { ...lead, phone: normPhone ? "+" + normPhone : phone.trim() || null, intlPhone: normPhone ? "+" + normPhone : phone.trim() || null } : lead;
  const n = niche ?? saved?.niche ?? undefined;
  const c = city ?? saved?.city ?? undefined;

  async function persist(patch: { audit?: Audit | null; message?: string | null }) {
    if (!lead) return;
    const row = await saveLead(eff, { niche: n, city: c, ...patch });
    setCurrent(row);
    qc.invalidateQueries({ queryKey: leadsKey });
    return row;
  }

  async function doSave() {
    setBusy("save");
    try {
      await persist({ audit, message: message || null });
      toast.success("Lead salvo no pipeline");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(s: LeadStatus) {
    if (!current) return;
    await updateLead(current.id, { status: s });
    setCurrent({ ...current, status: s });
    qc.invalidateQueries({ queryKey: leadsKey });
  }

  async function applyScript(id: string) {
    const s = scripts.find((x) => x.id === id);
    if (!s || !lead) return;
    setScriptId(id);
    setMessage(fillScript(s.body, { name: lead.name, city: c ?? null, niche: n ?? null, rating: lead.rating, reviews: lead.reviews, website: lead.website }));
    if (current) {
      await updateLead(current.id, { script_id: id });
      qc.invalidateQueries({ queryKey: leadsKey });
    }
  }

  async function sendWhatsapp() {
    const url = whatsappLink(eff.intlPhone ?? eff.phone, message);
    if (!url) {
      toast.error("Esta empresa não tem telefone cadastrado.");
      return;
    }
    window.open(url, "_blank", "noopener");
    try {
      const row = current ?? (await persist({ audit, message }));
      if (row) {
        const status = row.status === "novo" ? "enviada" : row.status;
        await updateLead(row.id, { message, status, last_contact_at: new Date().toISOString(), ...(scriptId ? { script_id: scriptId } : {}) });
        setCurrent({ ...row, status, message });
        qc.invalidateQueries({ queryKey: leadsKey });
      }
    } catch {
      /* ignore */
    }
  }

  const wa = whatsappLink(eff.intlPhone ?? eff.phone, message);
  const sortedScripts = [...scripts].sort((a, b) => Number(scriptMatches(b, { niche: n ?? null, website: lead.website })) - Number(scriptMatches(a, { niche: n ?? null, website: lead.website })));

  async function savePhone() {
    if (!current) { toast.success("Número ajustado — será usado ao salvar ou agendar"); return; }
    await updateLead(current.id, { phone: normPhone ? "+" + normPhone : phone.trim() || null });
    qc.invalidateQueries({ queryKey: leadsKey });
    toast.success("Número atualizado");
  }

  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-2xl min-w-0 overflow-y-auto rounded-lg p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="break-words pr-6 text-left text-xl leading-snug">{lead.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <OpportunityBadge lead={lead} />
          <span>★ {lead.rating?.toFixed(1) ?? "—"} · {lead.reviews} avaliações</span>

          {lead.mapsUrl && (
            <a href={lead.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              Google Maps <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {lead.website && (
            <a href={lead.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              Site <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <div className="flex gap-2">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ex.: +55 68 92316302 ou (68) 99231-6302" className="min-w-0" />
          <Button variant="outline" onClick={savePhone}><Pencil className="h-4 w-4" /> Salvar número</Button>
        </div>

        {phone.trim() && (
          <p className="-mt-2 text-xs text-muted-foreground">{normPhone ? <>Será usado: <b>{formatBR(normPhone)}</b></> : "Número incompleto — confira o DDD."}</p>
        )}

        {current && (
           <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg bg-muted p-3">
            <span className="text-sm font-medium">Status:</span>
            <Select value={current.status} onValueChange={(v) => setStatus(v as LeadStatus)}>
               <SelectTrigger className="min-w-0 w-full max-w-56 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <section className="space-y-3">
          <h3 className="font-semibold">Mensagem de abordagem</h3>
          <div className="rounded-lg border p-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><ScrollText className="h-4 w-4 text-primary" /> Usar script pronto</p>
            {scripts.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum script salvo. Crie na aba Scripts.</p>
            ) : (
              <Select value={scriptId ?? ""} onValueChange={applyScript}>
                <SelectTrigger className="min-w-0 w-full"><SelectValue placeholder="Escolha um script" /></SelectTrigger>
                <SelectContent>
                  {sortedScripts.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{scriptMatches(s, { niche: n ?? null, website: lead.website }) ? "★ " : ""}{s.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Textarea
            rows={7}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escolha um script acima ou escreva sua mensagem."
          />
           <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
             <Button className="col-span-2 bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90 sm:col-span-1" disabled={!message || !wa} onClick={sendWhatsapp}>
              <MessageCircle className="h-4 w-4" /> Abrir no WhatsApp
            </Button>
            <Button variant="outline" disabled={!message} onClick={() => { navigator.clipboard.writeText(message); toast.success("Copiado"); }}>
              <Copy className="h-4 w-4" /> Copiar
            </Button>
            {!current && (
               <Button variant="secondary" className="col-span-2 sm:col-span-1" onClick={doSave} disabled={busy !== null}>
                <Save className="h-4 w-4" /> Salvar no pipeline
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <SaveToBlock leads={[eff]} niche={n} city={c} />
            <ScheduleSend target={{ name: lead.name, phone: eff.intlPhone ?? eff.phone, city: c ?? null, niche: n ?? null, rating: lead.rating, reviews: lead.reviews, website: lead.website, leadId: current?.id ?? null }} />
          </div>
          {!wa && <p className="text-xs text-muted-foreground">Esta empresa não tem telefone no Google.</p>}
        </section>

        {current && (
          <section className="space-y-2">
            <h3 className="font-semibold">Anotações</h3>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: falar com a dona, prefere contato à tarde" />
            <Button size="sm" variant="outline" onClick={async () => { await updateLead(current.id, { notes, message }); qc.invalidateQueries({ queryKey: leadsKey }); toast.success("Salvo"); }}>
              Salvar anotações
            </Button>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
