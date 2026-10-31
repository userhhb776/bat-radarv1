import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bot, Flame, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listAgents, saveAgent, deleteAgent, agentConversations, talkToAgent, designAgent } from "@/lib/agents.functions";
import { waList } from "@/lib/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/agentes")({
  head: () => ({ meta: [
    { title: "Agentes — BatRadar" }, { name: "description", content: "Crie agentes que mineram, abordam, respondem clientes e avisam você." },
    { property: "og:title", content: "Agentes — BatRadar" }, { property: "og:description", content: "Agentes de vendas autônomos treinados por você." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});

type A = { id?: string; name: string; mission: string; offer: string; rules: string; ideal_client: string; learned?: string; instance: string; ai_provider: "native" | "custom"; ai_key?: string; model: string; active: boolean; auto_reply: boolean; training_mode: boolean };
const blank: A = { name: "", mission: "", offer: "", rules: "", ideal_client: "", instance: "", ai_provider: "native", ai_key: "", model: "gpt-oss:120b", active: false, auto_reply: true, training_mode: false };

function Page() {
  const qc = useQueryClient();
  const list = useServerFn(listAgents);
  const wa = useServerFn(waList);
  const { data } = useQuery({ queryKey: ["agents"], queryFn: () => list() });
  const { data: inst = [] } = useQuery({ queryKey: ["wa_instances"], queryFn: () => wa(), retry: 1 });
  const [edit, setEdit] = useState<A | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const agents = (data?.agents ?? []) as any[];
  const save = useServerFn(saveAgent);
  const toggle = async (a: any) => { await save({ data: { ...a, ai_key: undefined, active: !a.active } }); qc.invalidateQueries({ queryKey: ["agents"] }); };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Bot className="h-6 w-6" /> Agentes</h1>
          <Button onClick={() => setEdit({ ...blank })}><Plus className="mr-1 h-4 w-4" />Novo agente</Button>
        </div>
        {edit && <Editor a={edit} admin={!!data?.admin} inst={inst} onClose={() => setEdit(null)} />}
        {!agents.length && !edit && <p className="text-muted-foreground">Nenhum agente ainda. Crie o primeiro e treine com suas regras.</p>}
        <div className="grid gap-3">
          {agents.map((a) => (
            <div key={a.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{a.instance || "sem número"} · {a.ai_provider === "custom" ? "IA própria" : "IA nativa"}{a.training_mode ? " · treinamento ligado" : ""}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={a.active} onCheckedChange={() => toggle(a)} aria-label="Ativar agente" />
                  <Button size="sm" variant="outline" onClick={() => setEdit({ ...a })}>Treinar</Button>
                  <Button size="sm" variant="outline" onClick={() => setOpen(open === a.id ? null : a.id)}>{open === a.id ? "Fechar" : "Abrir"}</Button>
                </div>
              </div>
              {open === a.id && <AgentPanel id={a.id} name={a.name} />}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function Editor({ a, admin, inst, onClose }: { a: A; admin: boolean; inst: Array<{ name: string; label: string }>; onClose: () => void }) {
  const qc = useQueryClient();
  const save = useServerFn(saveAgent);
  const del = useServerFn(deleteAgent);
  const [f, setF] = useState<A>(a);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof A, v: any) => setF((p) => ({ ...p, [k]: v }));
  async function submit() {
    setBusy(true);
    try { await save({ data: { ...f, id: f.id } as any }); toast.success("Agente salvo"); qc.invalidateQueries({ queryKey: ["agents"] }); onClose(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); } finally { setBusy(false); }
  }
  const [mode, setMode] = useState<"chat" | "form">(a.id ? "form" : "chat");
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex gap-2">
        <Button type="button" size="sm" variant={mode === "chat" ? "default" : "outline"} onClick={() => setMode("chat")}>Modo chat</Button>
        <Button type="button" size="sm" variant={mode === "form" ? "default" : "outline"} onClick={() => setMode("form")}>Formulário</Button>
      </div>
      {mode === "chat" && <DesignChat f={f} onDraft={(d) => setF((p) => ({ ...p, ...Object.fromEntries(Object.entries(d).filter(([, v]) => v !== "")) }))} />}
      {mode === "chat" && f.name && <p className="text-xs text-muted-foreground">Rascunho: <b>{f.name}</b>. Veja e ajuste em "Formulário", escolha o número e salve.</p>}
      {mode === "form" && <>
      <Field label="Nome do agente"><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Vega" /></Field>
      <Field label="Missão (o que ele faz)"><Textarea rows={2} value={f.mission} onChange={(e) => set("mission", e.target.value)} placeholder="Minerar clínicas sem site em Rio Branco, abordar e marcar reunião" /></Field>
      <Field label="O que você vende agora"><Textarea rows={2} value={f.offer} onChange={(e) => set("offer", e.target.value)} placeholder="Sites a partir de R$ 600, gestão de Instagram..." /></Field>
      <Field label="Empresas que você mais quer"><Textarea rows={2} value={f.ideal_client} onChange={(e) => set("ideal_client", e.target.value)} placeholder="Nota acima de 4.3, mais de 50 avaliações, sem site" /></Field>
      <Field label="Regras rígidas (jeito de falar, o que nunca dizer)"><Textarea rows={4} value={f.rules} onChange={(e) => set("rules", e.target.value)} placeholder="Nunca falar preço na primeira mensagem. Falar como gente, curto..." /></Field>
      {f.learned && <Field label="O que ele já aprendeu com você"><p className="whitespace-pre-wrap rounded bg-muted p-2 text-xs">{f.learned}</p></Field>}
      <Field label="Número de WhatsApp do agente">
        <select className="w-full rounded-md border bg-background p-2 text-sm" value={f.instance} onChange={(e) => set("instance", e.target.value)}>
          <option value="">— escolha —</option>
          {inst.map((i) => <option key={i.name} value={i.name}>{i.label}</option>)}
        </select>
      </Field>
      <Field label="Inteligência">
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={f.ai_provider === "native" ? "default" : "outline"} onClick={() => set("ai_provider", "native")}>Nativa (Argos)</Button>
          <Button type="button" size="sm" variant={f.ai_provider === "custom" ? "default" : "outline"} onClick={() => set("ai_provider", "custom")}>Chave própria do Ollama</Button>
        </div>
        {f.ai_provider === "custom" && <Input className="mt-2" type="password" value={f.ai_key ?? ""} onChange={(e) => set("ai_key", e.target.value)} placeholder="Cole a chave do Ollama" />}
      </Field>
      <Toggle label="Responder clientes sozinho" v={f.auto_reply} on={(v) => set("auto_reply", v)} />
      {admin && <Toggle label="Modo treinamento (falo com ele pelo +55 68 99231-6302)" v={f.training_mode} on={(v) => set("training_mode", v)} />}
      <Toggle label="Agente ativo" v={f.active} on={(v) => set("active", v)} />
      </>}
      <div className="flex justify-between">
        {f.id ? <Button variant="ghost" onClick={async () => { await del({ data: { id: f.id! } }); qc.invalidateQueries({ queryKey: ["agents"] }); onClose(); }}><Trash2 className="mr-1 h-4 w-4" />Excluir</Button> : <span />}
        <div className="flex gap-2"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={busy || !f.name} onClick={submit}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Salvar</Button></div>
      </div>
    </div>
  );
}

function DesignChat({ f, onDraft }: { f: A; onDraft: (d: Partial<A>) => void }) {
  const design = useServerFn(designAgent);
  const [msgs, setMsgs] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!text.trim() || busy) return;
    const next = [...msgs, { role: "user" as const, content: text.trim() }];
    setMsgs(next); setText(""); setBusy(true);
    try {
      const { name, mission, offer, ideal_client, rules, auto_reply } = f;
      const r = await design({ data: { messages: next.slice(-20), current: { name, mission, offer, ideal_client, rules, auto_reply } } });
      setMsgs([...next, { role: "assistant", content: r.reply }]); onDraft(r.agent);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-2">
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {!msgs.length && <p className="text-xs text-muted-foreground">Diga o que quer, ex: "Quero um agente que encontre academias sem site em Rio Branco, ofereça site por R$ 800 e fale de forma descontraída".</p>}
        {msgs.map((m, i) => <div key={i} className={`rounded-lg p-2 text-sm ${m.role === "user" ? "ml-8 bg-primary text-primary-foreground" : "mr-8 bg-muted"}`}>{m.content}</div>)}
      </div>
      <div className="flex gap-2"><Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Descreva o agente ou peça mudanças..." /><Button disabled={busy} onClick={send}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button></div>
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="space-y-1"><Label>{label}</Label>{children}</div>;
const Toggle = ({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) => <label className="flex items-center justify-between gap-3 text-sm"><span>{label}</span><Switch checked={v} onCheckedChange={on} /></label>;

function AgentPanel({ id, name }: { id: string; name: string }) {
  const conv = useServerFn(agentConversations);
  const talk = useServerFn(talkToAgent);
  const { data: rows = [] } = useQuery({ queryKey: ["agent-msgs", id], queryFn: () => conv({ data: { id } }), refetchInterval: 30000 });
  const [sel, setSel] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const threads = new Map<string, { name: string; last: string; hot: boolean; at: string }>();
  for (const r of rows as any[]) if (!threads.has(r.phone)) threads.set(r.phone, { name: r.contact_name || r.phone, last: r.body, hot: false, at: r.created_at });
  for (const r of rows as any[]) if (r.hot) threads.get(r.phone)!.hot = true;
  const sorted = [...threads.entries()].sort((a, b) => Number(b[1].hot) - Number(a[1].hot));
  async function send() {
    if (!text.trim()) return;
    const next = [...msgs, { role: "user" as const, content: text.trim() }];
    setMsgs(next); setText(""); setBusy(true);
    try { const r = await talk({ data: { id, messages: next.slice(-20) } }); setMsgs([...next, { role: "assistant", content: r.reply }]); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); } finally { setBusy(false); }
  }
  return (
    <Tabs defaultValue="falar" className="mt-3">
      <TabsList><TabsTrigger value="falar">Falar com {name}</TabsTrigger><TabsTrigger value="conversas">Conversas ({threads.size})</TabsTrigger></TabsList>
      <TabsContent value="falar" className="space-y-2">
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {msgs.map((m, i) => <div key={i} className={`rounded-lg p-2 text-sm ${m.role === "user" ? "ml-8 bg-primary text-primary-foreground" : "mr-8 bg-muted"}`}>{m.content}</div>)}
          {!msgs.length && <p className="text-xs text-muted-foreground">Ex: "o que a Clínica Sorriso respondeu?", "minere 20 academias em Rio Branco sem site", "prefiro empresas com mais de 100 avaliações".</p>}
        </div>
        <div className="flex gap-2"><Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Dê uma ordem ou pergunte..." /><Button disabled={busy} onClick={send}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button></div>
      </TabsContent>
      <TabsContent value="conversas">
        {!sorted.length && <p className="text-sm text-muted-foreground">Nenhuma conversa ainda.</p>}
        <div className="space-y-1">
          {sorted.map(([phone, t]) => (
            <div key={phone}>
              <button className="flex w-full items-center justify-between rounded p-2 text-left text-sm hover:bg-muted" onClick={() => setSel(sel === phone ? null : phone)}>
                <span className="flex items-center gap-1 font-medium">{t.hot && <Flame className="h-4 w-4 text-destructive" />}{t.name}</span>
                <span className="ml-2 truncate text-xs text-muted-foreground">{t.last}</span>
              </button>
              {sel === phone && <div className="space-y-1 p-2">{(rows as any[]).filter((r) => r.phone === phone).reverse().map((r, i) => <div key={i} className={`rounded p-2 text-xs ${r.direction === "in" ? "mr-8 bg-muted" : "ml-8 bg-accent"}`}>{r.body}</div>)}</div>}
            </div>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
