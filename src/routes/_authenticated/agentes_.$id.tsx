import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, ArrowLeft, Flame, Image as ImageIcon, Loader2, Mic, Pause, Pickaxe, Play, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { agentCockpit, saveAgentDetails, runAgentMiner, sendManual, setPause, addAudio, deleteAudio, studyPrint, moveToMyLeads, importBlockToAgent, listMyBlocks, saveBtx, saveLimp, varyMessage, buildBtxPlan, approveTest } from "@/lib/agent-cockpit.functions";
import { STATES } from "@/lib/mining-options";
import { talkToAgent } from "@/lib/agents.functions";

export const Route = createFileRoute("/_authenticated/agentes_/$id")({
  head: () => ({ meta: [
    { title: "Painel do agente — BatRadar" }, { name: "description", content: "Veja o agente trabalhando ao vivo, suas conversas, minerador, roteiro e áudios." },
    { property: "og:title", content: "Painel do agente — BatRadar" }, { property: "og:description", content: "Cockpit individual do agente de vendas." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Cockpit,
});

type Step = { title: string; goal: string; message: string };
const ago = (d: string) => { const m = Math.round((Date.now() - new Date(d).getTime()) / 60000); return m < 1 ? "agora" : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };

function Cockpit() {
  const { id } = Route.useParams();
  const load = useServerFn(agentCockpit);
  const { data, isLoading } = useQuery({ queryKey: ["cockpit", id], queryFn: () => load({ data: { id } }), refetchInterval: 6000 });
  if (isLoading || !data) return <AppShell><div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div></AppShell>;
  const a = data.agent as any;
  const s = data.stats;
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/agentes" className="text-muted-foreground"><ArrowLeft className="h-5 w-5" /></Link>
          <h1 className="text-2xl font-bold">{a.name}</h1>
          <span className={`rounded-full px-2 py-0.5 text-xs ${a.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{a.active ? "trabalhando" : "desligado"}</span>
          <span className="text-xs text-muted-foreground">{a.instance || "sem número"}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {[["Mineradas", s.mineradas], ["Na fila", s.fila], ["Abordadas", s.abordadas], ["Responderam", s.responderam], ["Quentes 🔥", s.quentes], ["Msgs enviadas", s.enviadas]].map(([l, v]) => (
            <div key={l as string} className="rounded-lg border bg-card p-2 text-center"><div className="text-lg font-bold">{v as number}</div><div className="text-[11px] text-muted-foreground">{l}</div></div>
          ))}
        </div>
        <Tabs defaultValue="vivo">
          <TabsList className="flex h-auto flex-wrap">
            <TabsTrigger value="vivo">Ao vivo</TabsTrigger>
            <TabsTrigger value="btx">B-T6X</TabsTrigger>
            <TabsTrigger value="limp">LIMP</TabsTrigger>
            <TabsTrigger value="conversas">Conversas</TabsTrigger>
            <TabsTrigger value="minerador">Minerador</TabsTrigger>
            <TabsTrigger value="roteiro">Roteiro e jeito</TabsTrigger>
            <TabsTrigger value="revisao">REVISÃO EMP</TabsTrigger>
            <TabsTrigger value="audios">Áudios</TabsTrigger>
            <TabsTrigger value="estudo">Estudar prints</TabsTrigger>
            <TabsTrigger value="falar">Dar ordens</TabsTrigger>
          </TabsList>
          <TabsContent value="btx"><Btx id={id} a={a} audios={data.audios as any[]} /></TabsContent>
          <TabsContent value="limp"><Limp id={id} a={a} /></TabsContent>
          <TabsContent value="vivo"><Live id={id} events={data.events as any[]} leads={data.leads as any[]} /></TabsContent>
          <TabsContent value="conversas"><Chats id={id} messages={data.messages as any[]} paused={data.paused as string[]} /></TabsContent>
          <TabsContent value="minerador"><Miner id={id} a={a} leads={data.leads as any[]} events={data.events as any[]} /></TabsContent>
          <TabsContent value="roteiro"><Script id={id} a={a} /></TabsContent>
          <TabsContent value="revisao"><Revisao leads={data.leads as any[]} /></TabsContent>
          <TabsContent value="audios"><Audios id={id} audios={data.audios as any[]} /></TabsContent>
          <TabsContent value="estudo"><Study id={id} learned={a.learned} /></TabsContent>
          <TabsContent value="falar"><Talk id={id} name={a.name} /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function Live({ id, events, leads }: { id: string; events: any[]; leads: any[] }) {
  const qc = useQueryClient();
  const approve = useServerFn(approveTest);
  const [busy, setBusy] = useState(false);
  const tests = leads.filter((l) => l.status === "teste");
  const queue = leads.filter((l) => l.status === "fila").sort((x, y) => String(x.send_at).localeCompare(String(y.send_at))).slice(0, 8);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-lg border bg-card p-3">
        <h3 className="mb-2 font-semibold">O que ele está fazendo</h3>
        {!events.length && <p className="text-sm text-muted-foreground">Nada ainda. Ligue o agente ou mande ele minerar.</p>}
        <ul className="space-y-1.5 text-sm">{events.map((e, i) => <li key={i} className="flex justify-between gap-2"><span>{e.text}</span><span className="shrink-0 text-xs text-muted-foreground">{ago(e.created_at)}</span></li>)}</ul>
      </div>
      <div className="rounded-lg border bg-card p-3">
        <h3 className="mb-2 font-semibold">Próximas abordagens</h3>
        {!queue.length && <p className="text-sm text-muted-foreground">Fila vazia.</p>}
        <ul className="space-y-1.5 text-sm">{queue.map((l) => <li key={l.id} className="flex justify-between gap-2"><span className="truncate">{l.name}</span><span className="shrink-0 text-xs text-muted-foreground">{new Date(l.send_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Rio_Branco" })}</span></li>)}</ul>
        {tests.length > 0 && <div className="mt-3 space-y-1 border-t pt-2">
          <p className="text-xs text-muted-foreground">{tests.length} empresa(s) do treino aguardando: {tests.slice(0, 5).map((l) => l.name).join(", ")}{tests.length > 5 ? "…" : ""}</p>
          <Button size="sm" disabled={busy} onClick={async () => { if (!confirm(`Aprovar e colocar ${tests.length} empresas na fila real de envio?`)) return; setBusy(true); try { const r = await approve({ data: { id } }); toast.success(`${r.aprovadas} empresas foram para a fila real`); qc.invalidateQueries({ queryKey: ["cockpit", id] }); } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); } finally { setBusy(false); } }}>Aprovar e começar de verdade</Button>
        </div>}
        <p className="mt-2 text-xs text-muted-foreground">Os envios seguem os dias e horários configurados no agente.</p>
      </div>
    </div>
  );
}

function Chats({ id, messages, paused }: { id: string; messages: any[]; paused: string[] }) {
  const qc = useQueryClient();
  const send = useServerFn(sendManual);
  const pause = useServerFn(setPause);
  const [sel, setSel] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  // mesma pessoa com ou sem o 9º dígito: agrupa por DDD + 8 últimos dígitos
  const pk = (p: string) => { const d = String(p).replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, ""); return d.slice(0, 2) + d.slice(-8); };
  const threads = useMemo(() => {
    const m = new Map<string, { name: string; last: string; at: string; hot: boolean }>();
    const keyPhone = new Map<string, string>();
    for (const r of messages) { if (String(r.phone).startsWith("treino")) continue; const k = pk(r.phone); if (!keyPhone.has(k)) keyPhone.set(k, r.phone); const ph = keyPhone.get(k)!; const t = m.get(ph) ?? { name: r.contact_name || r.phone, last: r.body, at: r.created_at, hot: false }; if (r.contact_name && t.name === r.phone) t.name = r.contact_name; t.hot ||= r.hot; m.set(ph, t); }
    return [...m.entries()].sort((a, b) => Number(b[1].hot) - Number(a[1].hot) || b[1].at.localeCompare(a[1].at));
  }, [messages]);
  const conv = sel ? messages.filter((r) => !String(r.phone).startsWith("treino") && pk(r.phone) === pk(sel)).slice().reverse() : [];
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [conv.length, sel]);
  const isPaused = !!sel && paused.includes(sel);
  async function submit() {
    if (!sel || !text.trim()) return;
    setBusy(true);
    try { await send({ data: { id, phone: sel, name: threads.find((t) => t[0] === sel)?.[1].name, text } }); setText(""); qc.invalidateQueries({ queryKey: ["cockpit", id] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); } finally { setBusy(false); }
  }
  return (
    <div className="grid gap-3 md:grid-cols-[260px_1fr]">
      <div className={`max-h-[60vh] space-y-1 overflow-y-auto rounded-lg border bg-card p-2 ${sel ? "hidden md:block" : ""}`}>
        {!threads.length && <p className="p-2 text-sm text-muted-foreground">Nenhuma conversa ainda.</p>}
        {threads.map(([phone, t]) => (
          <button key={phone} onClick={() => setSel(phone)} className={`w-full rounded p-2 text-left text-sm hover:bg-muted ${sel === phone ? "bg-muted" : ""}`}>
            <div className="flex items-center gap-1 font-medium">{t.hot && <Flame className="h-4 w-4 text-destructive" />}{t.name}{paused.includes(phone) && <Pause className="h-3 w-3 text-muted-foreground" />}</div>
            <div className="truncate text-xs text-muted-foreground">{t.last}</div>
          </button>
        ))}
      </div>
      {sel ? (
        <div className="flex flex-col rounded-lg border bg-card">
          <div className="flex items-center justify-between gap-2 border-b p-2">
            <button className="text-sm md:hidden" onClick={() => setSel(null)}><ArrowLeft className="h-4 w-4" /></button>
            <span className="truncate text-sm font-medium">{threads.find((t) => t[0] === sel)?.[1].name}</span>
            <Button size="sm" variant={isPaused ? "default" : "outline"} onClick={async () => { await pause({ data: { id, phone: sel, paused: !isPaused } }); qc.invalidateQueries({ queryKey: ["cockpit", id] }); }}>
              {isPaused ? <><Play className="mr-1 h-3 w-3" />Devolver pra IA</> : <><Pause className="mr-1 h-3 w-3" />Assumir</>}
            </Button>
          </div>
          <div className="max-h-[50vh] flex-1 space-y-1.5 overflow-y-auto p-3">
            {conv.map((r) => <div key={r.id} className={`max-w-[80%] rounded-lg p-2 text-sm ${r.direction === "in" ? "bg-muted" : "ml-auto bg-primary text-primary-foreground"}`}>{r.body}<div className="mt-0.5 text-[10px] opacity-70">{r.manual ? "você · " : ""}{ago(r.created_at)}</div></div>)}
            <div ref={end} />
          </div>
          <div className="flex gap-2 border-t p-2">
            <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Escreva e envie pelo WhatsApp do agente..." />
            <Button disabled={busy} onClick={submit}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
          </div>
          <p className="px-2 pb-2 text-[11px] text-muted-foreground">Ao enviar, a IA fica pausada nesta conversa até você clicar em "Devolver pra IA".</p>
        </div>
      ) : <div className="hidden items-center justify-center rounded-lg border text-sm text-muted-foreground md:flex">Escolha uma conversa</div>}
    </div>
  );
}

function Miner({ id, a, leads, events }: { id: string; a: any; leads: any[]; events: any[] }) {
  const qc = useQueryClient();
  const save = useServerFn(saveAgentDetails);
  const run = useServerFn(runAgentMiner);
  const move = useServerFn(moveToMyLeads);
  const imp = useServerFn(importBlockToAgent);
  const blocksFn = useServerFn(listMyBlocks);
  const { data: blocks = [] } = useQuery({ queryKey: ["myblocks"], queryFn: () => blocksFn() });
  const [m, setM] = useState<any>({ daily: 15, ...(a.miner ?? {}) });
  const [busy, setBusy] = useState(false);
  const [sel, setSelSet] = useState<Set<string>>(new Set());
  const [block, setBlock] = useState("");
  const base = { id, context: a.context ?? "", style: a.style ?? "", pace: a.pace ?? "equilibrado", script_steps: a.script_steps ?? [] };
  const wrap = async (fn: () => Promise<any>, ok: (r: any) => string) => { setBusy(true); try { const r = await fn(); toast.success(ok(r)); qc.invalidateQueries({ queryKey: ["cockpit", id] }); } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); } finally { setBusy(false); } };
  const visible = leads.filter((l) => l.status !== "movido");
  const tests = events.filter((e) => e.kind === "teste");
  return (
    <div className="space-y-4">
      {m.md_teste && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border bg-card p-3">
            <h3 className="mb-2 font-semibold">md-teste: o que ele faria</h3>
            {!tests.length && <p className="text-xs text-muted-foreground">Clique em "Minerar agora". Nada é enviado.</p>}
            <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">{tests.map((e, i) => <li key={i} className="rounded bg-muted p-2">{e.text}</li>)}</ul>
          </div>
          <div><h3 className="mb-2 font-semibold">Corrija ele aqui</h3><Talk id={id} name={a.name} /></div>
        </div>
      )}
      <div className="space-y-3 rounded-lg border bg-card p-3">
        <h3 className="font-semibold">Minerador</h3>
        <p className="text-xs text-muted-foreground">Já vem de fábrica: só empresas sem site (ele varre a internet), abertas, com WhatsApp, boas avaliações e fotos. Fica só com ele, sem misturar com seus leads.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input placeholder="Nicho (ex: academias)" value={m.niche ?? ""} onChange={(e) => setM({ ...m, niche: e.target.value })} />
          <Input type="number" placeholder="Quantas por vez" value={m.daily ?? 15} onChange={(e) => setM({ ...m, daily: Math.max(1, Math.min(60, Number(e.target.value) || 15)) })} />
        </div>
        <div>
          <Label className="text-xs">Estados</Label>
          <div className="mt-1 flex flex-wrap gap-1">{STATES.map((uf) => { const on = (m.states ?? []).includes(uf); return <button key={uf} type="button" onClick={() => setM({ ...m, states: on ? m.states.filter((x: string) => x !== uf) : [...(m.states ?? []), uf] })} className={`rounded-md border px-2 py-1 text-xs ${on ? "bg-primary text-primary-foreground" : "bg-background"}`}>{uf}</button>; })}</div>
        </div>
        <Row label="Minerar sozinho todo dia" v={!!m.auto} on={(v) => setM({ ...m, auto: v })} />
        <Row label="Mandar a abordagem sozinho" v={!!m.auto_approach} on={(v) => setM({ ...m, auto_approach: v })} />
        <Row label="Abordagem inicial pelo B-T6X" v={!!m.btx_opening} on={(v) => setM({ ...m, btx_opening: v })} />
        {m.btx_opening && <p className="text-xs text-muted-foreground">No B-T6X, crie uma situação com "abordagem inicial" e várias variações; ele sorteia uma por empresa.</p>}
        <Row label="md-teste (faz tudo, menos mandar mensagem)" v={!!m.md_teste} on={(v) => setM({ ...m, md_teste: v })} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => wrap(() => save({ data: { ...base, miner: m } }), () => "Minerador salvo")}>Salvar</Button>
          <Button disabled={busy} onClick={() => wrap(async () => { await save({ data: { ...base, miner: m } }); return run({ data: { id } }); }, (r) => r.erro ?? `${r.novas} empresas novas`)}><Pickaxe className="mr-1 h-4 w-4" />Minerar agora</Button>
        </div>
      </div>
      <div className="space-y-2 rounded-lg border bg-card p-3">
        <h3 className="font-semibold">Usar um bloco seu</h3>
        <div className="flex flex-wrap gap-2">
          <select className="min-w-0 flex-1 rounded-md border bg-background p-2 text-sm" value={block} onChange={(e) => setBlock(e.target.value)}>
            <option value="">— escolha um bloco —</option>{blocks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <Button variant="outline" disabled={!block || busy} onClick={() => wrap(() => imp({ data: { id, blockId: block, approach: !!m.auto_approach } }), (r) => `${r.importadas} empresas passadas pro agente`)}>Passar pro agente</Button>
        </div>
      </div>
      <div className="rounded-lg border bg-card p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="font-semibold">Carteira do agente ({visible.length})</h3>
          <Button size="sm" variant="outline" disabled={!sel.size || busy} onClick={() => wrap(() => move({ data: { id, leadIds: [...sel] } }), (r) => { setSelSet(new Set()); return `${r.movidos} movidas para seus leads`; })}>Mover {sel.size || ""} pros meus leads</Button>
        </div>
        <div className="max-h-96 space-y-1 overflow-y-auto">
          {!visible.length && <p className="text-xs text-muted-foreground">Nenhuma empresa ainda. Clique em "Minerar agora".</p>}
          {visible.map((l) => {
            const q = l.qualification ?? {};
            return (
              <details key={l.id} className="rounded border p-1.5 text-sm">
                <summary className="flex cursor-pointer list-none items-center gap-2">
                  <input type="checkbox" disabled={l.status === "teste"} checked={sel.has(l.id)} onClick={(e) => e.stopPropagation()} onChange={(e) => { const n = new Set(sel); e.target.checked ? n.add(l.id) : n.delete(l.id); setSelSet(n); }} />
                  <span className="min-w-0 flex-1 truncate">{l.name}<span className="ml-1 text-xs text-muted-foreground">{l.city} · ⭐{l.rating ?? "-"} ({l.reviews_count}){l.photos != null ? ` · ${l.photos} fotos` : ""}</span></span>
                  <span className={`rounded px-1.5 text-[11px] ${l.status === "teste" ? "bg-accent text-accent-foreground" : "bg-muted"}`}>{l.status === "teste" ? "simulação" : l.status}</span>
                </summary>
                <div className="mt-2 grid gap-1 rounded bg-muted p-2 text-xs">
                  <div><b>Telefone:</b> {l.phone ?? "-"} · <b>Nicho:</b> {l.niche}</div>
                  <div><b>Endereço:</b> {l.address ?? "-"}{q.estado ? ` · Estados buscados: ${q.estado}` : ""}</div>
                  <div><b>Nota:</b> ⭐{l.rating ?? "-"} · <b>Avaliações:</b> {l.reviews_count} · <b>Fotos:</b> {l.photos ?? "?"} · <b>Aberta:</b> {q.aberta === false ? "não" : "sim"}</div>
                  <div><b>Site:</b> {q.site ?? (l.website ? `só rede social (${l.website})` : "sem site")} · <b>Varredura:</b> {q.varredura_web ?? "-"}</div>
                  {l.maps_url && <a className="text-primary underline" href={l.maps_url} target="_blank" rel="noreferrer">Ver no Google Maps</a>}
                  {q.abordagem && <div className="mt-1 rounded border bg-background p-2"><b>Abordagem {q.via_btx ? "(B-T6X)" : "(roteiro)"}:</b> {q.abordagem}</div>}
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Script({ id, a }: { id: string; a: any }) {
  const qc = useQueryClient();
  const save = useServerFn(saveAgentDetails);
  const [context, setContext] = useState(a.context ?? "");
  const [style, setStyle] = useState(a.style ?? "");
  const [pace, setPace] = useState<"rapido" | "equilibrado" | "calmo">(a.pace ?? "equilibrado");
  const [steps, setSteps] = useState<Step[]>(a.script_steps?.length ? a.script_steps : [{ title: "Abordagem", goal: "Puxar conversa com curiosidade", message: "Opa, tudo bem? Aqui é o Antonio. Vi a {nome} no Google, vocês atendem pelo WhatsApp mesmo?" }]);
  const [busy, setBusy] = useState(false);
  const up = (i: number, k: keyof Step, v: string) => setSteps(steps.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <F label="Contexto (sobre você, o que vende, preços que pode citar, diferenciais)"><Textarea rows={4} value={context} onChange={(e) => setContext(e.target.value)} /></F>
      <F label="Como ele deve falar"><Textarea rows={3} value={style} onChange={(e) => setStyle(e.target.value)} placeholder='Ex: falo "opa", "show", "massa". Frases curtas, sem textão. Nunca uso "prezado".' /></F>
      <F label="Tempo de resposta">
        <div className="flex flex-wrap gap-2">
          {([["rapido", "Ágil (6–15s)"], ["equilibrado", "Normal (15–40s)"], ["calmo", "Ocupado (40–85s)"]] as const).map(([k, l]) => <Button key={k} size="sm" type="button" variant={pace === k ? "default" : "outline"} onClick={() => setPace(k)}>{l}</Button>)}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Ele espera esse tempo "lendo", mostra "digitando…" e, se o cliente mandar várias mensagens seguidas, responde tudo de uma vez.</p>
      </F>
      <div className="space-y-2">
        <Label>Roteiro por etapas</Label>
        <p className="text-xs text-muted-foreground">A 1ª etapa é a mensagem de abordagem. Use {"{nome}"}, {"{cidade}"}, {"{nicho}"}. Linha em branco = balão separado.</p>
        {steps.map((s, i) => (
          <div key={i} className="space-y-1.5 rounded border p-2">
            <div className="flex gap-2"><Input value={s.title} onChange={(e) => up(i, "title", e.target.value)} placeholder={`Etapa ${i + 1}`} /><Button size="icon" variant="ghost" onClick={() => setSteps(steps.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></div>
            <Input value={s.goal} onChange={(e) => up(i, "goal", e.target.value)} placeholder="Objetivo desta etapa" />
            <Textarea rows={2} value={s.message} onChange={(e) => up(i, "message", e.target.value)} placeholder="Mensagem modelo (ele adapta)" />
          </div>
        ))}
        {steps.length < 10 && <Button size="sm" variant="outline" onClick={() => setSteps([...steps, { title: "", goal: "", message: "" }])}><Plus className="mr-1 h-4 w-4" />Etapa</Button>}
      </div>
      <Button disabled={busy} onClick={async () => { setBusy(true); try { await save({ data: { id, context, style, pace, script_steps: steps.filter((s) => s.title || s.message), miner: a.miner ?? {} } }); toast.success("Roteiro salvo"); qc.invalidateQueries({ queryKey: ["cockpit", id] }); } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); } finally { setBusy(false); } }}>Salvar roteiro</Button>
    </div>
  );
}

function Audios({ id, audios }: { id: string; audios: any[] }) {
  const qc = useQueryClient();
  const add = useServerFn(addAudio);
  const del = useServerFn(deleteAudio);
  const [title, setTitle] = useState("");
  const [trigger, setTrigger] = useState("");
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  async function upload(blob: Blob): Promise<void> {
    if (!title.trim()) { toast.error("Dê um nome ao áudio."); return; }
    if (blob.size > 1_400_000) { toast.error("Áudio muito grande (máx ~1 minuto)."); return; }
    setBusy(true);
    try {
      const b64 = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.readAsDataURL(blob); });
      await add({ data: { id, title, trigger, mime: blob.type || "audio/ogg", data: b64 } });
      setTitle(""); setTrigger(""); toast.success("Áudio salvo"); qc.invalidateQueries({ queryKey: ["cockpit", id] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); } finally { setBusy(false); }
  }
  async function toggleRec() {
    if (rec) { rec.stop(); setRec(null); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream); const parts: Blob[] = [];
      r.ondataavailable = (e) => parts.push(e.data);
      r.onstop = () => { stream.getTracks().forEach((t) => t.stop()); upload(new Blob(parts, { type: r.mimeType })); };
      r.start(); setRec(r);
    } catch { toast.error("Não consegui acessar o microfone."); }
  }
  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-lg border bg-card p-3">
        <p className="text-xs text-muted-foreground">O cliente recebe como áudio gravado na hora (microfone verde). O agente escolhe o áudio quando o momento bate com o gatilho.</p>
        <Input placeholder="Nome (ex: Como funciona)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input placeholder="Quando enviar (ex: cliente pergunta como funciona ou pede detalhes)" value={trigger} onChange={(e) => setTrigger(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Button variant={rec ? "destructive" : "default"} disabled={busy} onClick={toggleRec}><Mic className="mr-1 h-4 w-4" />{rec ? "Parar e salvar" : "Gravar"}</Button>
          <label className="inline-flex cursor-pointer items-center rounded-md border px-3 text-sm">Enviar arquivo<input type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
      </div>
      {audios.map((x) => (
        <div key={x.id} className="flex items-center justify-between gap-2 rounded-lg border bg-card p-2 text-sm">
          <div><div className="font-medium">🎤 {x.title}</div><div className="text-xs text-muted-foreground">{x.trigger || "sem gatilho"}</div></div>
          <Button size="icon" variant="ghost" onClick={async () => { await del({ data: { id: x.id } }); qc.invalidateQueries({ queryKey: ["cockpit", id] }); }}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
    </div>
  );
}

function Study({ id, learned }: { id: string; learned: string }) {
  const qc = useQueryClient();
  const study = useServerFn(studyPrint);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState("");
  async function onFile(f: File) {
    setBusy(true);
    try {
      const img = await new Promise<string>((res, rej) => {
        const i = new Image(); i.onload = () => { const s = Math.min(1, 1400 / Math.max(i.width, i.height)); const c = document.createElement("canvas"); c.width = i.width * s; c.height = i.height * s; c.getContext("2d")!.drawImage(i, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", 0.8)); };
        i.onerror = rej; i.src = URL.createObjectURL(f);
      });
      const r = await study({ data: { id, image: img, note } });
      setLast(r.lesson); toast.success("Estudado! A imagem não foi guardada."); qc.invalidateQueries({ queryKey: ["cockpit", id] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-lg border bg-card p-3">
        <p className="text-xs text-muted-foreground">Mande prints das suas conversas que deram certo. Ele lê, aprende seu jeito e descarta a imagem (nada fica salvo além do aprendizado em texto).</p>
        <Input placeholder="Observação (opcional, ex: essa fechou em 2 dias)" value={note} onChange={(e) => setNote(e.target.value)} />
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}Escolher print<input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} /></label>
        {last && <p className="whitespace-pre-wrap rounded bg-muted p-2 text-xs">{last}</p>}
      </div>
      {learned && <div className="rounded-lg border bg-card p-3"><h3 className="mb-1 font-semibold">Tudo que ele já aprendeu</h3><p className="max-h-80 overflow-y-auto whitespace-pre-wrap text-xs">{learned}</p></div>}
    </div>
  );
}

function Talk({ id, name }: { id: string; name: string }) {
  const talk = useServerFn(talkToAgent);
  const [msgs, setMsgs] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!text.trim() || busy) return;
    const next = [...msgs, { role: "user" as const, content: text.trim() }];
    setMsgs(next); setText(""); setBusy(true);
    try { const r = await talk({ data: { id, messages: next.slice(-20) } }); setMsgs([...next, { role: "assistant", content: r.reply }]); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {msgs.map((m, i) => <div key={i} className={`rounded-lg p-2 text-sm ${m.role === "user" ? "ml-8 bg-primary text-primary-foreground" : "mr-8 bg-muted"}`}>{m.content}</div>)}
        {!msgs.length && <p className="text-xs text-muted-foreground">Ex: "minere 20 academias em Rio Branco pra você", "quem merece mais atenção hoje?", "a partir de agora ofereça gestão de Instagram".</p>}
      </div>
      <div className="flex gap-2"><Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={`Fale com ${name}...`} /><Button disabled={busy} onClick={send}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button></div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1"><Label>{label}</Label>{children}</div>; }
function Row({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) { return <div className="flex items-center justify-between gap-2"><Label>{label}</Label><Switch checked={v} onCheckedChange={on} /></div>; }

type BRule = { when: string; variants: string[]; mode?: "alternatives" | "sequence" | undefined; audio_id?: string | undefined };
function normalizeBtxLabels(rules: BRule[]) {
  const groups = new Map<string, { label: string; type: "mensagem" | "passo"; rows: Array<{ index: number; order: number }> }>();
  rules.forEach((rule, index) => {
    const match = /^(.*?)(?:\\s*[-–—:]?\\s*)(mensagem|passo)\\s*(\\d+)\\s*$/i.exec(rule.when.trim());
    if (!match) return;
    const label = match[1]!.trim(), type = match[2]!.toLowerCase() as "mensagem" | "passo";
    const key = `${label.toLowerCase().replace(/\\s+/g, " ")}|${type}`;
    const group = groups.get(key) ?? { label, type, rows: [] };
    group.rows.push({ index, order: Number(match[3]) }); groups.set(key, group);
  });
  const result = rules.slice();
  for (const group of groups.values()) {
    const orderCounts = new Set(group.rows.map((row) => row.order));
    if (orderCounts.size === group.rows.length) group.rows.sort((a, b) => a.order - b.order || a.index - b.index);
    else group.rows.sort((a, b) => a.index - b.index);
    group.rows.forEach((row, index) => { result[row.index] = { ...result[row.index]!, when: `${group.label} — ${group.type === "mensagem" ? "Mensagem" : "Passo"} ${index + 1}` }; });
  }
  return result;
}
function Limp({ id, a }: { id: string; a: any }) {
  const qc = useQueryClient();
  const save = useServerFn(saveLimp);
  const [enabled, setEnabled] = useState<boolean>(!!a.limp?.enabled);
  const [entriesText, setEntriesText] = useState<string>((a.limp?.entries ?? []).join("\\n"));
  const [busy, setBusy] = useState(false);
  const entries = entriesText.split(/\\r?\\n/).map((x) => x.trim()).filter(Boolean);
  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div>
        <h3 className="font-semibold">LIMP — Lista de Interrupção de Mensagens</h3>
        <p className="mt-1 text-sm text-muted-foreground">Cadastre palavras, assuntos ou frases que o agente não deve responder. O LIMP é consultado antes do B-T6X e da IA: se houver correspondência, a mensagem é ignorada e registrada no painel.</p>
      </div>
      <Row label="Ativar proteção LIMP" v={enabled} on={setEnabled} />
      <F label="Uma regra por linha">
        <Textarea rows={9} value={entriesText} onChange={(e) => setEntriesText(e.target.value)} placeholder={"finanças\nNão quero receber mensagens\nPare de entrar em contato\nRemova meu número\nassunto pessoal"} />
      </F>
      <p className="text-xs text-muted-foreground">A comparação ignora maiúsculas, acentos e pontuação. Ex.: a regra “finanças” também encontra “gostaria de falar sobre finanças”. Regras de descadastro como “pare de entrar em contato” também pausam permanentemente a automação para aquele contato.</p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{entries.length} regra(s) cadastrada(s)</span>
        <Button disabled={busy} onClick={async () => { setBusy(true); try { await save({ data: { id, limp: { enabled, entries } } }); qc.invalidateQueries({ queryKey: ["cockpit", id] }); toast.success("LIMP salvo"); } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar"); } finally { setBusy(false); } }}>Salvar LIMP</Button>
      </div>
    </div>
  );
}
function Btx({ id, a, audios }: { id: string; a: any; audios: any[] }) {
  const qc = useQueryClient();
  const save = useServerFn(saveBtx), vary = useServerFn(varyMessage), plan = useServerFn(buildBtxPlan);
  const [prompt, setPrompt] = useState<string>(a.btx?.prompt ?? "");
  const [rules, setRules] = useState<BRule[]>(() => normalizeBtxLabels(a.btx?.rules ?? []));
  const [busy, setBusy] = useState("");
  const setRule = (i: number, r: Partial<BRule>) => setRules(rules.map((x, j) => (j === i ? { ...x, ...r } : x)));
  const setVar = (i: number, k: number, v: string) => setRule(i, { variants: rules[i]!.variants.map((x, j) => (j === k ? v : x)) });
  const run = async (tag: string, fn: () => Promise<void>) => { setBusy(tag); try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "Falhou"); } finally { setBusy(""); } };
  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <p className="text-sm text-muted-foreground">Cada cartão representa uma situação ou mensagem numerada. Use Alternativas somente para textos equivalentes que podem ser sorteados no mesmo momento. Mensagens enviadas em sequência devem ficar em cartões separados ("Mensagem 1", "Mensagem 2"); quando o cliente precisa responder para avançar, use Passos numerados. O agente respeita a ordem.</p>
      <F label="Prompt de abordagem e conversa">
        <Textarea rows={6} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder='Ex: Ao iniciar use as mensagens do script "Barbearias". Se disser que não quer, fale: "tranquilo, obrigado!". Se a atendente disser que vai passar pro dono, fale: "show, fico no aguardo". Se perguntar como funciona, fale...' />
      </F>
      <Button size="sm" variant="secondary" disabled={!!busy || prompt.trim().length < 5} onClick={() => run("plan", async () => { const r = await plan({ data: { id, prompt } }); setRules(r.rules); toast.success("Funil criado — revise e salve"); })}>
        {busy === "plan" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Montar funil com IA
      </Button>
      {rules.map((r, i) => (
        <div key={i} className="space-y-2 rounded-md border p-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">{i + 1}.</span>
            <Input value={r.when} onChange={(e) => setRule(i, { when: e.target.value })} placeholder="Situação específica (ex: cliente informa que já possui equipe de marketing)" />
            <Button size="icon" variant="ghost" onClick={() => setRules(rules.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap items-center gap-2"><Label className="text-xs">Tipo de resposta</Label><select className="rounded-md border bg-background px-2 py-1 text-sm" value={r.mode ?? "alternatives"} onChange={(e) => setRule(i, { mode: (e.target.value as "alternatives" | "sequence") || undefined })}><option value="alternatives">Alternativas (sortear)</option><option value="sequence">Sequência linear (em ordem)</option></select></div>
          {r.variants.map((v, k) => (
            <div key={k} className="flex items-start gap-1">
              <Textarea rows={2} value={v} onChange={(e) => setVar(i, k, e.target.value)} placeholder={r.mode === "sequence" ? `Passo ${k + 1}` : `Variação ${k + 1}`} />
              <div className="flex flex-col">
                <Button size="icon" variant="ghost" title="Gerar variação com IA" disabled={r.mode === "sequence" || !!busy || !v.trim()} onClick={() => run(`v${i}-${k}`, async () => { const o = await vary({ data: { id, text: v } }); if (r.variants.length < 6) setRule(i, { variants: [...r.variants, o.text] }); else setVar(i, k, o.text); })}>
                  {busy === `v${i}-${k}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-primary" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setRule(i, { variants: r.variants.filter((_, j) => j !== k) })}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            {r.variants.length < 6 && <Button size="sm" variant="outline" onClick={() => setRule(i, { variants: [...r.variants, ""] })}><Plus className="h-3 w-3" /> {r.mode === "sequence" ? "Próximo passo" : "Variação"}</Button>}
            <Mic className="h-4 w-4 text-muted-foreground" />
            <select className="rounded-md border bg-background px-2 py-1 text-sm" value={r.audio_id ?? ""} onChange={(e) => setRule(i, { audio_id: e.target.value || undefined })}>
              <option value="">Sem áudio</option>{audios.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
            </select>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={rules.length >= 25} onClick={() => setRules([...rules, { when: "", variants: [""], mode: "alternatives" }])}><Plus className="h-4 w-4" /> Situação</Button>
        <Button size="sm" disabled={!!busy} onClick={() => run("save", async () => { await save({ data: { id, btx: { prompt, rules: rules.map((r) => ({ ...r, variants: r.variants.filter((v) => v.trim()) })).filter((r) => r.when.trim()) } } }); qc.invalidateQueries({ queryKey: ["cockpit", id] }); toast.success("B-T6X salvo"); })}>Salvar B-T6X</Button>
      </div>
      <p className="text-xs text-muted-foreground">Dica: use {"{nome}"} para o nome da empresa. Para responder com áudio, grave-o antes na aba Áudios.</p>
    </div>
  );
}

function Revisao({ leads }: { leads: any[] }) {
  const rows = leads.filter((l) => l.status === "revisao" || l.status === "erro");
  if (!rows.length) return <p className="p-4 text-sm text-muted-foreground">Nenhuma empresa para revisar. Aqui aparecem as que o agente não conseguiu chamar (telefone inválido ou sem WhatsApp).</p>;
  return <div className="space-y-2">{rows.map((l) => <div key={l.id} className="rounded-md border p-3 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2"><b>{l.name}</b><span className="rounded bg-muted px-1.5 text-[11px]">{l.status === "revisao" ? "telefone inválido / sem WhatsApp" : "falha no envio"}</span></div>
    <div className="text-muted-foreground">{l.phone ?? "sem telefone"} · {l.city}{l.address ? ` · ${l.address}` : ""}</div>
    {l.maps_url && <a className="text-primary underline" href={l.maps_url} target="_blank" rel="noreferrer">Abrir no Google Maps</a>}
  </div>)}</div>;
}
