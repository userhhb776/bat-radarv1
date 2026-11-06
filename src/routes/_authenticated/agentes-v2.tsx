import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Brain, Loader2, Plus, Rocket, Send, FlaskConical, Smartphone, UserRound, MessageSquareText, GraduationCap, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AgentAvatar } from "@/components/AgentAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { listAgents, saveAgent } from "@/lib/agents.functions";
import { waList } from "@/lib/whatsapp.functions";
import { startTestV2 } from "@/lib/agent-cockpit.functions";
import { createV2Agent, savePersona, simulateV2, type Persona } from "@/lib/agent-squad.functions";

export const Route = createFileRoute("/_authenticated/agentes-v2")({
  head: () => ({ meta: [
    { title: "Agentes V2 — BatRadar" }, { name: "description", content: "Agentes que conversam como pessoas reais, com personalidade, treino e testes." },
    { property: "og:title", content: "Agentes V2 — BatRadar" }, { property: "og:description", content: "Nova geração de agentes conversacionais BatRadar." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});

const blankP: Persona = { role: "", backstory: "", personality: "", voice: "", formality: 4, energy: 6, emoji: "pouco", length: "curta", slang: "", forbidden: "", human_typos: false, never_reveal_ai: true, handoff: "", examples: "", training: "" };

function Page() {
  const qc = useQueryClient();
  const list = useServerFn(listAgents);
  const create = useServerFn(createV2Agent);
  const { data } = useQuery({ queryKey: ["agents"], queryFn: () => list() });
  const agents = ((data?.agents ?? []) as any[]).filter((a) => a.squad === "v2");
  const [sel, setSel] = useState<string | null>(null);
  const cur = agents.find((a) => a.id === sel) ?? agents[0];
  const add = async () => {
    const name = prompt("Nome do novo agente V2?")?.trim(); if (!name) return;
    const r = await create({ data: { name } }); await qc.invalidateQueries({ queryKey: ["agents"] }); setSel(r.id);
  };
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-4 p-4">
        <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/20 via-card to-card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">BatRadar · Nova geração</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold"><Brain className="h-6 w-6" /> Agentes V2</h1>
          <p className="mt-1 text-sm text-muted-foreground">Agentes que conversam como uma pessoa real. Monte a identidade, treine, teste e publique.</p>
          <Button className="mt-3" onClick={add}><Plus className="mr-1 h-4 w-4" />Novo agente V2</Button>
        </section>
        {agents.length > 1 && <div className="flex gap-2 overflow-x-auto pb-1">
          {agents.map((a) => <button key={a.id} onClick={() => setSel(a.id)} className={`flex shrink-0 items-center gap-2 rounded-full border px-2 py-1 text-sm ${cur?.id === a.id ? "border-primary bg-primary/10" : ""}`}><AgentAvatar name={a.name} url={a.avatar_url} className="h-7 w-7" />{a.name}</button>)}
        </div>}
        {!cur && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhum agente V2 ainda. Crie o primeiro acima.</p>}
        {cur && <Editor key={cur.id} a={cur} admin={!!data?.admin} />}
      </div>
    </AppShell>
  );
}

function Editor({ a, admin }: { a: any; admin: boolean }) {
  const qc = useQueryClient();
  const wa = useServerFn(waList);
  const { data: inst = [] } = useQuery({ queryKey: ["wa_instances"], queryFn: () => wa(), retry: 1 });
  const save = useServerFn(savePersona);
  const saveA = useServerFn(saveAgent);
  const v2 = useServerFn(startTestV2);
  const [name, setName] = useState<string>(a.name);
  const [instance, setInstance] = useState<string>(a.instance ?? "");
  const [p, setP] = useState<Persona>({ ...blankP, ...(a.persona ?? {}) });
  const [busy, setBusy] = useState("");
  const set = <K extends keyof Persona>(k: K, v: Persona[K]) => setP((x) => ({ ...x, [k]: v }));
  const persist = async () => { await save({ data: { id: a.id, name, instance, persona: p } }); await qc.invalidateQueries({ queryKey: ["agents"] }); };
  const run = async (k: string, fn: () => Promise<unknown>, ok: string) => { setBusy(k); try { await fn(); toast.success(ok); } catch (e: any) { toast.error(e.message ?? "Erro"); } finally { setBusy(""); } };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4">
        <AgentAvatar id={a.id} name={name} url={a.avatar_url} editable className="h-20 w-20 border-2" />
        <div className="min-w-0 flex-1 space-y-1">
          <Input value={name} onChange={(e) => setName(e.target.value)} className="text-lg font-bold" aria-label="Nome" />
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${a.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{a.active ? "publicado" : "rascunho"}</span>
        </div>
      </div>

      <Card icon={Smartphone} title="Número de WhatsApp">
        <select className="w-full rounded-md border bg-background px-2 py-2 text-sm" value={instance} onChange={(e) => setInstance(e.target.value)}>
          <option value="">— escolha o número —</option>
          {(inst as any[]).map((i: any) => { const n = i.name ?? i.instanceName ?? i; return <option key={n} value={n}>{i.label ?? n}</option>; })}
        </select>
      </Card>

      <Card icon={UserRound} title="Função e identidade">
        <F l="Função (o que ele faz)"><Textarea rows={2} value={p.role} onChange={(e) => set("role", e.target.value)} placeholder="Ex.: atende quem responde a abordagem e marca uma conversa comigo" /></F>
        <F l="Quem ele é (história curta)"><Textarea rows={2} value={p.backstory} onChange={(e) => set("backstory", e.target.value)} placeholder="Ex.: Lucas, 27 anos, trabalha com sites em Rio Branco" /></F>
        <F l="Personalidade"><Input value={p.personality} onChange={(e) => set("personality", e.target.value)} placeholder="simpático, direto, paciente" /></F>
      </Card>

      <Card icon={MessageSquareText} title="Como deve falar">
        <F l="Jeito de falar"><Textarea rows={2} value={p.voice} onChange={(e) => set("voice", e.target.value)} placeholder="Ex.: fala como amigo, frases curtas, sem textão" /></F>
        <Sl l="Formalidade" v={p.formality} on={(v) => set("formality", v)} a="Descontraído" b="Formal" />
        <Sl l="Energia" v={p.energy} on={(v) => set("energy", v)} a="Calmo" b="Animado" />
        <div className="grid grid-cols-2 gap-3">
          <F l="Emojis"><Sel v={p.emoji} on={(v) => set("emoji", v as Persona["emoji"])} o={[["nunca", "Nunca"], ["pouco", "Pouco"], ["medio", "Às vezes"]]} /></F>
          <F l="Tamanho das mensagens"><Sel v={p.length} on={(v) => set("length", v as Persona["length"])} o={[["curtissima", "Bem curta"], ["curta", "Curta"], ["media", "Média"]]} /></F>
        </div>
        <F l="Expressões que usa"><Input value={p.slang} onChange={(e) => set("slang", e.target.value)} placeholder="opa, show, tranquilo" /></F>
        <F l="Nunca dizer"><Input value={p.forbidden} onChange={(e) => set("forbidden", e.target.value)} placeholder="prezado, estimado cliente, solução inovadora" /></F>
        <T l="Escrever como gente no celular" v={p.human_typos} on={(v) => set("human_typos", v)} />
      </Card>

      <Card icon={ShieldCheck} title="Como deve agir">
        <T l="Nunca revelar que é IA" v={p.never_reveal_ai} on={(v) => set("never_reveal_ai", v)} />
        <F l="Quando me chamar para assumir"><Textarea rows={2} value={p.handoff} onChange={(e) => set("handoff", e.target.value)} placeholder="cliente pede preço fechado, reclama, ou quer falar comigo" /></F>
      </Card>

      <Card icon={GraduationCap} title="Treinamento">
        <F l="O que ele precisa saber"><Textarea rows={4} value={p.training} onChange={(e) => set("training", e.target.value)} placeholder="Preços, prazos, como funciona o serviço, respostas para objeções..." /></F>
        <F l="Exemplos de conversa (cliente → resposta)"><Textarea rows={4} value={p.examples} onChange={(e) => set("examples", e.target.value)} placeholder={"Cliente: quanto custa?\nVocê: depende do que precisa, me fala rapidinho do seu negócio?"} /></F>
      </Card>

      <div className="sticky bottom-2 z-10 flex flex-wrap gap-2 rounded-xl border bg-card/95 p-2 backdrop-blur">
        <Button variant="outline" disabled={!!busy} onClick={() => run("s", persist, "Salvo")}>{busy === "s" && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Salvar</Button>
        {admin && <Button variant="secondary" disabled={!!busy} onClick={() => run("v2", async () => { await persist(); await v2({ data: { id: a.id } }); }, "TESTE V2 enviado para o seu número")}><Send className="mr-1 h-4 w-4" />TESTE V2</Button>}
        <Button className="ml-auto" disabled={!!busy} onClick={() => run("pub", async () => { if (!instance) throw new Error("Escolha o número antes de publicar."); await persist(); await saveA({ data: { ...a, name, instance, ai_key: undefined, active: true, training_mode: false } }); await qc.invalidateQueries({ queryKey: ["agents"] }); }, "Publicado")}><Rocket className="mr-1 h-4 w-4" />Publicar</Button>
      </div>

      <TestV1 name={name} p={p} />
      <p className="text-xs text-muted-foreground">Abordagem, minerador e roteiro B-T6X ficam no <Link to="/agentes/$id" params={{ id: a.id }} className="underline">painel completo</Link>.</p>
    </div>
  );
}

function TestV1({ name, p }: { name: string; p: Persona }) {
  const sim = useServerFn(simulateV2);
  const [msgs, setMsgs] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [txt, setTxt] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setMsgs([]); }, [name]);
  const send = async () => {
    if (!txt.trim()) return;
    const next = [...msgs, { role: "user" as const, content: txt.trim() }].slice(-30);
    setMsgs(next); setTxt(""); setBusy(true);
    try { const r = await sim({ data: { name, persona: p, messages: next } }); setMsgs([...next, { role: "assistant", content: r.reply }]); }
    catch (e: any) { toast.error(e.message ?? "Erro"); } finally { setBusy(false); }
  };
  return (
    <Card icon={FlaskConical} title="TESTE V1 — você faz o papel do cliente (nada é enviado)">
      <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg bg-muted/40 p-3">
        {!msgs.length && <p className="text-xs text-muted-foreground">Escreva como se fosse um cliente para ver como ele responde.</p>}
        {msgs.map((m, i) => <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-card"}`}>{m.content}</div>)}
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      </div>
      <div className="flex gap-2"><Input value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Mensagem do cliente..." /><Button onClick={send} disabled={busy}><Send className="h-4 w-4" /></Button></div>
    </Card>
  );
}

const Card = ({ icon: I, title, children }: { icon: any; title: string; children: React.ReactNode }) => <section className="space-y-3 rounded-2xl border bg-card p-4"><h2 className="flex items-center gap-2 font-semibold"><I className="h-4 w-4 text-primary" />{title}</h2>{children}</section>;
const F = ({ l, children }: { l: string; children: React.ReactNode }) => <div className="space-y-1"><Label className="text-xs">{l}</Label>{children}</div>;
const T = ({ l, v, on }: { l: string; v: boolean; on: (v: boolean) => void }) => <label className="flex items-center justify-between gap-3 text-sm"><span>{l}</span><Switch checked={v} onCheckedChange={on} /></label>;
const Sel = ({ v, on, o }: { v: string; on: (v: string) => void; o: string[][] }) => <select className="w-full rounded-md border bg-background px-2 py-2 text-sm" value={v} onChange={(e) => on(e.target.value)}>{o.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>;
const Sl = ({ l, v, on, a, b }: { l: string; v: number; on: (v: number) => void; a: string; b: string }) => <div className="space-y-1"><Label className="text-xs">{l}: {v}/10</Label><Slider value={[v]} min={0} max={10} step={1} onValueChange={(x) => on(x[0] ?? v)} /><div className="flex justify-between text-[11px] text-muted-foreground"><span>{a}</span><span>{b}</span></div></div>;
