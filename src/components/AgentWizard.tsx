import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ImagePlus, Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { saveAgent, deleteAgent, designAgent } from "@/lib/agents.functions";
import { saveAgentDetails, studyPrint, runAgentMiner, startTestV2 } from "@/lib/agent-cockpit.functions";
import { STATES } from "@/lib/mining-options";

const STEPS = ["Nome", "Número", "Instruções", "O que entendeu", "Mensagens", "Minerador", "Envios", "Revisão"];
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
type Step = { title: string; goal: string; message: string };

export function AgentWizard({ a, admin, inst, onClose }: { a: any; admin: boolean; inst: Array<{ name: string; label: string }>; onClose: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const save = useServerFn(saveAgent);
  const saveD = useServerFn(saveAgentDetails);
  const del = useServerFn(deleteAgent);
  const mine = useServerFn(runAgentMiner);
  const v2 = useServerFn(startTestV2);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({ ai_provider: "native", model: "gpt-oss:120b", auto_reply: true, active: false, training_mode: false, mission: "", offer: "", rules: "", ideal_client: "", instance: "", ...a });
  const [steps, setSteps] = useState<Step[]>(a.script_steps?.length ? a.script_steps : [{ title: "Abordagem inicial", goal: "Primeiro contato", message: "" }]);
  const m0 = a.miner ?? {};
  const [m, setM] = useState<any>({ niches: m0.niches ?? (m0.niche ? [m0.niche] : []), states: m0.states ?? [], daily: m0.daily ?? 15, auto_approach: m0.auto_approach ?? true, btx_opening: m0.btx_opening ?? false, dias: m0.dias ?? [1, 2, 3, 4, 5], hora_inicio: m0.hora_inicio ?? 8, hora_fim: m0.hora_fim ?? 18, gap_min: m0.gap_min ?? 6, gap_max: m0.gap_max ?? 15, limite_dia: m0.limite_dia ?? 30, open_gap_min: m0.open_gap_min ?? 12, open_gap_max: m0.open_gap_max ?? 17 });
  const [pace, setPace] = useState<string>(a.pace ?? "calmo");
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const sm = (k: string, v: any) => setM((p: any) => ({ ...p, [k]: v }));
  const tog = (k: string, x: any) => sm(k, m[k].includes(x) ? m[k].filter((y: any) => y !== x) : [...m[k], x]);

  async function persist(extra: Record<string, any> = {}) {
    const r = await save({ data: { id: f.id, name: f.name, mission: f.mission ?? "", offer: f.offer ?? "", rules: f.rules ?? "", ideal_client: f.ideal_client ?? "", instance: f.instance ?? "", ai_provider: f.ai_provider, ai_key: f.ai_key, model: f.model, active: f.active, auto_reply: f.auto_reply, training_mode: f.training_mode, ...extra } as any });
    const id = r.id as string;
    setF((p: any) => ({ ...p, id, ...extra }));
    await saveD({ data: { id, context: a.context ?? "", style: a.style ?? "", pace, script_steps: steps.filter((s) => s.message.trim() || s.title.trim()).slice(0, 10), miner: { ...m0, ...m, niche: m.niches[0] ?? "", md_teste: !!extra["_teste"] } } });
    qc.invalidateQueries({ queryKey: ["agents"] });
    return id;
  }
  async function next() {
    if (step === 0 && !f.name?.trim()) { toast.error("Dê um nome ao agente."); return; }
    setBusy(true);
    try { if (step >= 1) await persist(); setStep(step + 1); } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); } finally { setBusy(false); }
  }
  async function finish(kind: "publicar" | "v1" | "v2") {
    setBusy(true);
    try {
      if (kind === "publicar") { const id = await persist({ active: true, training_mode: false }); toast.success("Agente publicado e trabalhando"); nav({ to: "/agentes/$id", params: { id } }); }
      if (kind === "v1") { const id = await persist({ active: true, _teste: true }); const r: any = await mine({ data: { id } }); toast.success(r?.erro ?? `Teste V1: ${r?.novas ?? 0} empresas analisadas, nada enviado`); nav({ to: "/agentes/$id", params: { id } }); }
      if (kind === "v2") { const id = await persist(); await v2({ data: { id } }); toast.success("Abordagem enviada para o seu WhatsApp. Responda como se fosse o cliente."); nav({ to: "/agentes/$id", params: { id } }); }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background"><div className="mx-auto max-w-3xl space-y-5 p-4 pb-24 sm:p-8">
      <div className="flex flex-wrap gap-1">
        {STEPS.map((s, i) => <button key={s} type="button" disabled={!f.id && i > 1} onClick={() => setStep(i)} className={`rounded-full px-2.5 py-1 text-xs ${i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}. {s}</button>)}
      </div>

      {step === 0 && <F label="Nome do agente"><Input autoFocus value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Vega" /></F>}

      {step === 1 && <F label="Número de WhatsApp que ele vai usar">
        <select className="w-full rounded-md border bg-background p-2 text-sm" value={f.instance} onChange={(e) => set("instance", e.target.value)}>
          <option value="">— escolha —</option>
          {inst.map((i) => <option key={i.name} value={i.name}>{i.label}</option>)}
        </select>
      </F>}

      {step === 2 && <Instruct f={f} id={f.id} onDraft={(d) => setF((p: any) => ({ ...p, ...Object.fromEntries(Object.entries(d).filter(([k, v]) => v !== "" && k !== "name")) }))} />}

      {step === 3 && <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Isto é o que o agente entendeu. Ajuste o que estiver errado.</p>
        <F label="Missão"><Textarea rows={2} value={f.mission} onChange={(e) => set("mission", e.target.value)} /></F>
        <F label="O que ele oferece"><Textarea rows={2} value={f.offer} onChange={(e) => set("offer", e.target.value)} /></F>
        <F label="Cliente ideal"><Textarea rows={2} value={f.ideal_client} onChange={(e) => set("ideal_client", e.target.value)} /></F>
        <F label="Como vai agir (regras e scripts)"><Textarea rows={6} value={f.rules} onChange={(e) => set("rules", e.target.value)} /></F>
      </div>}

      {step === 4 && <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Mensagens prontas, na ordem. Use {"{nome}"} e {"{cidade}"} para personalizar.</p>
        {steps.map((s, i) => <div key={i} className="space-y-2 rounded-md border p-2">
          <div className="flex gap-2"><Input value={s.title} onChange={(e) => setSteps(steps.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} placeholder="Etapa" /><Button size="icon" variant="ghost" onClick={() => setSteps(steps.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></div>
          <Textarea rows={3} value={s.message} onChange={(e) => setSteps(steps.map((x, j) => j === i ? { ...x, message: e.target.value } : x))} placeholder="Texto da mensagem" />
        </div>)}
        {steps.length < 10 && <Button size="sm" variant="outline" onClick={() => setSteps([...steps, { title: "", goal: "", message: "" }])}>+ Mensagem</Button>}
        <Tg label="Usar o B-T6X na abordagem inicial" v={m.btx_opening} on={(v) => sm("btx_opening", v)} />
      </div>}

      {step === 5 && <div className="space-y-3">
        <F label="Nichos (separe por vírgula)"><Input defaultValue={m.niches.join(", ")} onBlur={(e) => sm("niches", e.target.value.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 10))} placeholder="Academia, Pilates, Clínica estética" /></F>
        <F label="Estados"><div className="flex flex-wrap gap-1">{STATES.map((s) => <button key={s} type="button" onClick={() => tog("states", s)} className={`rounded px-2 py-1 text-xs ${m.states.includes(s) ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{s}</button>)}</div></F>
        <F label="Empresas por mineração"><Num v={m.daily} on={(n) => sm("daily", n)} /></F>
        <p className="text-xs text-muted-foreground">Filtros de fábrica: sem site próprio, aberta, com WhatsApp, 5+ avaliações e 3+ fotos.</p>
      </div>}

      {step === 6 && <div className="space-y-3">
        <F label="Dias de disparo"><div className="flex flex-wrap gap-1">{DIAS.map((d, i) => <button key={d} type="button" onClick={() => tog("dias", i)} className={`rounded px-2 py-1 text-xs ${m.dias.includes(i) ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{d}</button>)}</div></F>
        <div className="grid grid-cols-2 gap-2">
          <F label="Começa às (h)"><Num v={m.hora_inicio} on={(n) => sm("hora_inicio", n)} /></F>
          <F label="Para às (h)"><Num v={m.hora_fim} on={(n) => sm("hora_fim", n)} /></F>
          <F label="Entre empresas: mín. (min)"><Num v={m.gap_min} on={(n) => sm("gap_min", n)} /></F>
          <F label="Entre empresas: máx. (min)"><Num v={m.gap_max} on={(n) => sm("gap_max", n)} /></F>
          <F label="Limite por dia"><Num v={m.limite_dia} on={(n) => sm("limite_dia", n)} /></F>
        </div>
        <F label="Abordagem inicial: tempo entre os balões (segundos)"><div className="grid grid-cols-2 gap-2"><Num v={m.open_gap_min ?? 12} on={(n) => sm("open_gap_min", n)} /><Num v={m.open_gap_max ?? 17} on={(n) => sm("open_gap_max", n)} /></div><p className="text-xs text-muted-foreground">Separe os balões com uma linha em branco na mensagem. Ex.: 12 a 17 s.</p></F>
        <F label={`Tempo para responder na conversa (${pace.startsWith("s:") ? pace.slice(2).replace("-", " a ") : ({ rapido: "6 a 15", equilibrado: "15 a 40", calmo: "40 a 85" } as any)[pace] ?? "15 a 40"} segundos)`}><div className="flex flex-wrap gap-2">{(["rapido", "equilibrado", "calmo"] as const).map((p) => <Button key={p} size="sm" type="button" variant={pace === p ? "default" : "outline"} onClick={() => setPace(p)}>{p === "rapido" ? "Rápido" : p === "equilibrado" ? "Equilibrado" : "Calmo"}</Button>)}<Button size="sm" type="button" variant={pace.startsWith("s:") ? "default" : "outline"} onClick={() => setPace("s:30-90")}>Personalizado</Button></div>
          {pace.startsWith("s:") && <div className="mt-2 grid grid-cols-2 gap-2"><F label="Mín. (segundos)"><Num v={Number(pace.slice(2).split("-")[0])} on={(n) => setPace(`s:${n}-${pace.slice(2).split("-")[1]}`)} /></F><F label="Máx. (segundos)"><Num v={Number(pace.slice(2).split("-")[1])} on={(n) => setPace(`s:${pace.slice(2).split("-")[0]}-${n}`)} /></F><p className="col-span-2 text-xs text-muted-foreground">Ex.: 120 = 2 minutos.</p></div>}</F>
        <Tg label="Abordar sozinho as empresas mineradas" v={m.auto_approach} on={(v) => sm("auto_approach", v)} />
        <Tg label="Responder clientes sozinho" v={f.auto_reply} on={(v) => set("auto_reply", v)} />
      </div>}

      {step === 7 && <div className="space-y-3 text-sm">
        <Sum k="Agente" v={f.name} /><Sum k="Número" v={f.instance || "—"} /><Sum k="Missão" v={f.mission} /><Sum k="Mensagens" v={`${steps.filter((s) => s.message.trim()).length} prontas${m.btx_opening ? " · abertura pelo B-T6X" : ""}`} />
        <Sum k="Minerador" v={`${m.niches.join(", ") || "—"} · ${m.states.join(", ") || "—"} · ${m.daily}/vez`} />
        <Sum k="Envios" v={`${m.dias.map((d: number) => DIAS[d]).join(", ")} · ${m.hora_inicio}h–${m.hora_fim}h · ${m.gap_min}–${m.gap_max} min entre empresas · até ${m.limite_dia}/dia`} />
        <p className="text-xs text-muted-foreground">O comando /dono12 continua ativo: mande pelo seu WhatsApp para dar ordens diretas ao agente.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button disabled={busy} onClick={() => finish("publicar")}>Publicar</Button>
          <Button disabled={busy} variant="secondary" onClick={() => finish("v1")}>TESTE V1 (sem enviar)</Button>
          {admin && <Button disabled={busy} variant="outline" onClick={() => finish("v2")}>TESTE V2 (no meu número)</Button>}
        </div>
      </div>}

      <div className="flex justify-between gap-2">
        <div className="flex gap-2">
          {f.id && <Button variant="ghost" onClick={async () => { await del({ data: { id: f.id } }); qc.invalidateQueries({ queryKey: ["agents"] }); onClose(); }}><Trash2 className="h-4 w-4" /></Button>}
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </div>
        <div className="flex gap-2">
          {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)}>Voltar</Button>}
          {step < 7 && <Button disabled={busy} onClick={next}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Avançar</Button>}
        </div>
      </div>
    </div></div>
  );
}

function Instruct({ f, id, onDraft }: { f: any; id?: string; onDraft: (d: any) => void }) {
  const design = useServerFn(designAgent);
  const study = useServerFn(studyPrint);
  const [msgs, setMsgs] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!text.trim() || busy) return;
    const n = [...msgs, { role: "user" as const, content: text.trim() }];
    setMsgs(n); setText(""); setBusy(true);
    try {
      const r = await design({ data: { messages: n.slice(-20), current: { name: f.name, mission: f.mission, offer: f.offer, ideal_client: f.ideal_client, rules: f.rules } } });
      setMsgs([...n, { role: "assistant", content: r.reply }]); onDraft(r.agent);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); } finally { setBusy(false); }
  }
  async function print(file?: File) {
    if (!file || !id) return;
    setBusy(true);
    try {
      const image = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file); });
      await study({ data: { id, image } });
      setMsgs((p) => [...p, { role: "assistant", content: "Li o print e guardei só o aprendizado (a imagem foi descartada)." }]);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-2">
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {!msgs.length && <p className="text-xs text-muted-foreground">Diga como ele deve se comportar e os scripts exatos. Ex: "Ao abordar mande X; se disser que não quer, responda Y". Você também pode enviar prints de conversas.</p>}
        {msgs.map((m, i) => <div key={i} className={`whitespace-pre-wrap rounded-lg p-2 text-sm ${m.role === "user" ? "ml-8 bg-primary text-primary-foreground" : "mr-8 bg-muted"}`}>{m.content}</div>)}
      </div>
      <div className="flex gap-2">
        <label className="inline-flex cursor-pointer items-center rounded-md border px-2" title="Enviar print"><ImagePlus className="h-4 w-4" /><input type="file" accept="image/*" className="hidden" onChange={(e) => print(e.target.files?.[0])} /></label>
        <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Instruções, scripts, ajustes..." />
        <Button disabled={busy} onClick={send}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
      </div>
    </div>
  );
}

const F = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="space-y-1"><Label>{label}</Label>{children}</div>;
const Tg = ({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) => <label className="flex items-center justify-between gap-3 text-sm"><span>{label}</span><input type="checkbox" checked={v} onChange={(e) => on(e.target.checked)} className="h-4 w-4" /></label>;
const Sum = ({ k, v }: { k: string; v: string }) => <div className="rounded-md bg-muted p-2"><span className="text-xs text-muted-foreground">{k}</span><div className="whitespace-pre-wrap">{v || "—"}</div></div>;

function Num({ v, on }: { v: number; on: (n: number) => void }) {
  const [t, setT] = useState(String(v ?? ""));
  return <Input inputMode="numeric" value={t} onChange={(e) => setT(e.target.value.replace(/[^0-9]/g, ""))} onBlur={() => { const n = Number(t); if (t !== "" && n >= 0) on(n); else setT(String(v ?? "")); }} />;
}
