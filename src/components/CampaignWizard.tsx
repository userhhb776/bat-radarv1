import { NumField } from "@/components/NumField";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Megaphone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { localIn } from "@/components/ScheduleSend";
import { Switch } from "@/components/ui/switch";
import { TEST_PACK, TEST_PACK_NAME } from "@/lib/test-pack";
import { HourSelect, WhenPicker, ampm } from "@/components/PapaLead";
import { fillScript, scriptMessages, type Script } from "@/lib/scripts";
import type { LeadBlock } from "@/lib/blocks";
import type { SavedLead } from "@/lib/leads";
import type { WaInstance } from "@/lib/whatsapp.functions";

export type Form = {
  name: string; instance: string; dailyLimit: number;
  target: "bloco" | "unica" | "pack" | "falhas"; block: string; lead: string; start: string; fromH: number; toH: number; days: number[];
  script: string; msgGap: number; minGap: number; maxGap: number; now: boolean;
};

const fmt = (v: string) => { const d = new Date(v); const h = d.getHours(); return `${d.toLocaleDateString("pt-BR")} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
const STEPS = ["Campanha", "Público e agenda", "Mensagens", "Revisar"];
const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const empty = (): Form => ({ name: "", instance: "", dailyLimit: 0, target: "bloco", block: "", lead: "", start: localIn(10), fromH: 8, toH: 18, days: [1, 2, 3, 4, 5], script: "", msgGap: 30, minGap: 180, maxGap: 420, now: false });

type Props = { open: boolean; onOpenChange: (o: boolean) => void; blocks: LeadBlock[]; scripts: Script[]; connected: WaInstance[]; leads: SavedLead[]; onPublish: (f: Form) => Promise<void>; initial?: Form | null };

export function CampaignWizard({ open, onOpenChange, blocks, scripts, connected, leads, onPublish, initial }: Props) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(empty);
  const [busy, setBusy] = useState(false);
  const edit = !!initial;
  useEffect(() => { if (open) { setStep(0); setF(initial ?? empty()); } }, [open, initial]);
  useEffect(() => { if (!f.instance && connected[0]) setF((x) => ({ ...x, instance: connected[0]!.name })); }, [connected, f.instance]);
  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));
  const numInput = (k: "dailyLimit" | "fromH" | "toH" | "msgGap" | "minGap" | "maxGap", min: number, max: number) => (
    <NumField value={Number(f[k])} min={min} max={max} onChange={(n) => set({ [k]: n } as Partial<Form>)} />
  );
  const script = scripts.find((s) => s.id === f.script);
  const block = blocks.find((b) => b.id === f.block);
  const lead = leads.find((l) => l.id === f.lead);
  const audience = f.target === "pack" ? TEST_PACK.length : (f.target === "bloco" || f.target === "falhas") ? block?.count ?? 0 : lead ? 1 : 0;

  function valid(i: number) {
    if (i === 0) return f.name.trim() && f.instance ? null : "Defina o nome e o número de envio.";
    if (i === 1) return (edit || f.target === "pack" || (f.target === "bloco" || f.target === "falhas" ? f.block : f.lead)) && f.start && f.days.length && f.toH > f.fromH ? null : "Escolha o público, início, dias e uma janela válida.";
    if (i === 2) return edit || script && scriptMessages(script).length ? null : "Escolha um script com mensagens.";
    return null;
  }
  function next() { const e = valid(step); if (e) { toast.error(e); return; } setStep(step + 1); }
  async function publish() {
    setBusy(true);
    try { await onPublish(f); onOpenChange(false); } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao publicar"); } finally { setBusy(false); }
  }
  const sample = f.target === "unica" && lead ? { name: lead.name, city: lead.city, niche: lead.niche, rating: lead.rating, reviews: lead.reviews_count, website: lead.website } : { name: "Empresa Exemplo", city: "Campinas", niche: block?.niche || "Barbearia", rating: 4.7, reviews: 120, website: null };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-0 p-4 sm:rounded-none sm:p-8">
        <div className="mx-auto w-full max-w-3xl space-y-5">
        <DialogHeader><DialogTitle className="text-2xl">{edit ? "Editar campanha" : "Criar campanha"}</DialogTitle></DialogHeader>
        <ol className="grid grid-cols-4 gap-1 text-xs">
          {STEPS.map((s, i) => (
            <li key={s} className={`rounded-md border px-2 py-1.5 text-center ${i === step ? "border-primary bg-primary/15 text-primary" : i < step ? "text-primary" : "text-muted-foreground"}`}>
              {i < step ? <Check className="mr-1 inline h-3 w-3" /> : `${i + 1}. `}{s}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="grid gap-3">
            <div><Label>Nome da campanha</Label><Input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: Barbearias outubro" /></div>
            <div><Label>Número de envio</Label>
              <Select value={f.instance} onValueChange={(v) => set({ instance: v })}><SelectTrigger><SelectValue placeholder="Nenhum conectado" /></SelectTrigger>
                <SelectContent>{connected.map((i) => <SelectItem key={i.name} value={i.name}>{i.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Orçamento: empresas por dia (0 = sem limite)</Label>{numInput("dailyLimit", 0, 100000)}</div>
            <div className="rounded-md border border-primary/40 bg-primary/10 p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-primary"><ShieldCheck className="h-4 w-4" /> Configuração recomendada (anti-banimento)</p>
              <p className="mt-1 text-xs text-muted-foreground">15 empresas/dia · seg a sex · 9h às 18h · 25s entre mensagens · 5 a 12 min aleatórios entre empresas. Você pode ajustar depois.</p>
              <Button type="button" size="sm" className="mt-2" onClick={() => { set({ dailyLimit: 15, fromH: 9, toH: 18, days: [1, 2, 3, 4, 5], msgGap: 25, minGap: 300, maxGap: 720 }); toast.success("Configuração segura aplicada"); }}>Aplicar recomendada</Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-3">
            {edit ? <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">O público não muda na edição. Os envios que ainda estão aguardando serão reprogramados com a nova agenda.</p> : <>
             <div><Label>Abordar</Label>
              <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Button type="button" variant={f.target === "bloco" ? "default" : "outline"} onClick={() => set({ target: "bloco" })}>Um bloco inteiro</Button>
                <Button type="button" variant={f.target === "unica" ? "default" : "outline"} onClick={() => set({ target: "unica" })}>Só uma empresa</Button>
                <Button type="button" variant={f.target === "pack" ? "default" : "outline"} onClick={() => set({ target: "pack" })}>{TEST_PACK_NAME}</Button>
                <Button type="button" variant={f.target === "falhas" ? "default" : "outline"} onClick={() => set({ target: "falhas" })}>Só erros / não enviadas</Button>
              </div></div>
            {f.target === "falhas" && <p className="rounded-md border border-primary/40 bg-primary/10 p-3 text-xs text-muted-foreground">Escolha o bloco: entram só as empresas que ainda não receberam nenhuma mensagem (as que deram erro ou nunca foram disparadas). Quem já recebeu fica de fora.</p>}
            {f.target === "pack" && (
              <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm">
                <p className="font-semibold text-primary">{TEST_PACK_NAME} · {TEST_PACK.length} números seus</p>
                <p className="mt-1 text-xs text-muted-foreground">{TEST_PACK.map((t) => t.phone).join(" · ")}. Use para conferir se os disparos estão saindo certinho.</p>
              </div>
            )}
            {f.target !== "pack" && (f.target === "bloco" || f.target === "falhas" ? (
              <div><Label>Bloco de leads</Label>
                <Select value={f.block} onValueChange={(v) => set({ block: v })}><SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                  <SelectContent>{blocks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name} ({b.count})</SelectItem>)}</SelectContent></Select></div>
            ) : (
              <div><Label>Empresa do pipeline</Label>
                <Select value={f.lead} onValueChange={(v) => set({ lead: v })}><SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                  <SelectContent className="max-h-72">{leads.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select></div>
            ))}</>}
            {!edit && <label className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm"><Switch checked={f.now} onCheckedChange={(v) => set({ now: v })} /> <span><b>Começar agora</b> — dispara em instantes, sem esperar horário, dias ou limite diário. Só respeita os intervalos entre mensagens e empresas.</span></label>}
            <div><Label>{edit ? "Reprogramar a partir de" : "Começar em"}</Label><WhenPicker value={f.start} onChange={(v) => set({ start: v })} />
              <p className="mt-1 text-xs text-muted-foreground">Data e hora do primeiro envio (se cair fora do horário abaixo, começa no próximo horário permitido).</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Enviar a partir das</Label><HourSelect value={f.fromH} min={0} max={23} onChange={(v) => set({ fromH: v })} /></div>
              <div><Label>Parar às</Label><HourSelect value={f.toH} min={1} max={24} onChange={(v) => set({ toH: v })} /></div>
            </div>
            <p className="text-xs text-muted-foreground">Só envia entre {ampm(f.fromH)} e {ampm(f.toH)}, nos dias marcados abaixo.</p>
            <div><Label>Dias da semana</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {DAYS.map((d, i) => (
                  <Button key={d} type="button" size="sm" variant={f.days.includes(i) ? "default" : "outline"}
                    onClick={() => set({ days: f.days.includes(i) ? f.days.filter((x) => x !== i) : [...f.days, i] })}>{d}</Button>
                ))}
              </div></div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-3">
            {!edit && <div><Label>Script (funil de mensagens)</Label>
              <Select value={f.script} onValueChange={(v) => set({ script: v })}><SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent>{scripts.map((s) => <SelectItem key={s.id} value={s.id}>{s.title} · {scriptMessages(s).length} msg</SelectItem>)}</SelectContent></Select></div>}
            <div className="grid gap-3 sm:grid-cols-3">
              <div><Label>Entre mensagens (s)</Label>{numInput("msgGap", 0, 3600)}</div>
              <div><Label>Entre empresas, mín. (s)</Label>{numInput("minGap", 0, 86400)}</div>
              <div><Label>Entre empresas, máx. (s)</Label>{numInput("maxGap", 0, 86400)}</div>
            </div>
            {script && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Prévia para {sample.name}</p>
                {scriptMessages(script).map((m, i) => <p key={i} className="mb-1 whitespace-pre-wrap break-words"><b>{i + 1}.</b> {fillScript(m, sample)}</p>)}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 rounded-md bg-muted p-3 text-sm">
            <dt className="text-muted-foreground">Campanha</dt><dd className="break-words">{f.name}</dd>
            <dt className="text-muted-foreground">Número</dt><dd>{connected.find((i) => i.name === f.instance)?.label}</dd>
            <dt className="text-muted-foreground">Limite/dia</dt><dd>{f.dailyLimit || "Sem limite"}</dd>
            {!edit && <><dt className="text-muted-foreground">Público</dt><dd className="break-words">{f.target === "pack" ? `${TEST_PACK_NAME} · ${TEST_PACK.length} números` : f.target === "falhas" ? `${block?.name} · só erros / não enviadas` : f.target === "bloco" ? `${block?.name} · ${audience} empresas` : lead?.name}</dd>
            <dt className="text-muted-foreground">Agenda</dt><dd>{f.now ? "Começa agora, sem esperar horário nem dias" : `${fmt(f.start)} · ${ampm(f.fromH)} às ${ampm(f.toH)} · ${[...f.days].sort().map((d) => DAYS[d]).join(", ")}`}</dd>
            <dt className="text-muted-foreground">Mensagens</dt><dd>{script?.title} · {script ? scriptMessages(script).length : 0} por empresa</dd>
            <dt className="text-muted-foreground">Total</dt><dd>{audience * (script ? scriptMessages(script).length : 0)} mensagens</dd></>}
          </dl>
        )}

        <div className="flex justify-between gap-2">
          <Button variant="outline" disabled={step === 0 || busy} onClick={() => setStep(step - 1)}>Voltar</Button>
          {step < 3 ? <Button onClick={next}>Avançar</Button> : <Button disabled={busy} onClick={publish}><Megaphone className="h-4 w-4" /> {edit ? "Salvar alterações" : "Publicar"}</Button>}
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
