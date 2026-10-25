import { NumField } from "@/components/NumField";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Plus, Trash2, Users, Upload, Pause, Play, ChevronDown, ChevronUp, Ban, Download, Rocket, X, ShieldCheck, Shuffle, ArrowLeft, ArrowRight, Check, Zap, Pencil, RefreshCw, MessageSquareReply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase as typed } from "@/integrations/supabase/client";
import { waList } from "@/lib/whatsapp.functions";
import { plDispatchNow, plWake, plGroupMembers, plGroups, type PlGroup, type PlMember } from "@/lib/papalead.functions";
import { TEST_PACK, TEST_PACK_NAME } from "@/lib/test-pack";
import { formatBR, normalizeBR } from "@/lib/phone";

// Papa Lead é um negócio separado: tabelas pl_* próprias, sem ligação com leads/blocos/campanhas do BatRadar.
const db = typed as unknown as SupabaseClient;

type List = { id: string; name: string; source: string; created_at: string; count: number };
type Contact = { id: string; list_id: string; name: string; phone: string; notes: string; opted_out: boolean };
type Script = { id: string; title: string; body: string; message2: string; message3: string; variants: string[][] };
const slots = (s: Script) => [s.body, s.message2, s.message3].map((m, i) => [m, ...((s.variants?.[i] ?? []).filter((v) => v.trim()))].filter((t) => t.trim()));
type Campaign = { id: string; name: string; list_id: string | null; instance: string; texts: string[]; daily_limit: number; min_gap_min: number; max_gap_min: number; window_start: number; window_end: number; weekdays_only: boolean; start_at: string; status: string; created_at: string; script_id: string | null };
type QueueRow = { id: string; campaign_id: string; name: string; phone: string; send_at: string; status: string; error: string | null; sent_at: string | null; replied: boolean; texts: string[] };

const err = (e: unknown) => toast.error(e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Falha");

async function fetchLists(): Promise<List[]> {
  const { data, error } = await db.from("pl_lists").select("*, pl_contacts(count)").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((l: Record<string, unknown>) => ({ ...(l as unknown as List), count: ((l["pl_contacts"] as Array<{ count: number }>)?.[0]?.count) ?? 0 }));
}
async function fetchScripts(): Promise<Script[]> {
  const { data, error } = await db.from("pl_scripts").select("*").order("created_at", { ascending: false });
  if (error) throw error; return data as Script[];
}

async function insertContacts(listId: string, rows: { name: string; phone: string }[]) {
  const seen = new Set<string>();
  const clean = rows.map((r) => ({ name: r.name.trim().slice(0, 80), phone: normalizeBR(r.phone) ?? "" }))
    .filter((r) => r.phone && !seen.has(r.phone) && seen.add(r.phone));
  if (!clean.length) throw new Error("Nenhum telefone válido encontrado.");
  for (let i = 0; i < clean.length; i += 500) {
    const { error } = await db.from("pl_contacts").upsert(clean.slice(i, i + 500).map((r) => ({ ...r, list_id: listId })), { onConflict: "list_id,phone", ignoreDuplicates: true });
    if (error) throw error;
  }
  return clean.length;
}

function parseLines(text: string) {
  return text.split(/\r?\n/).map((line) => {
    const cells = line.split(/[;,\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    const phoneIdx = cells.findIndex((c) => c.replace(/\D/g, "").length >= 10);
    if (phoneIdx < 0) return null;
    const name = cells.filter((_, i) => i !== phoneIdx).find((c) => c && !/^\d+$/.test(c)) ?? "";
    return { name, phone: cells[phoneIdx]! };
  }).filter((x): x is { name: string; phone: string } => !!x);
}

/* ------------------------------- Contatos ------------------------------- */

function ListRow({ l, onChanged }: { l: List; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const { data: contacts = [], refetch } = useQuery({ queryKey: ["pl_contacts", l.id], enabled: open, queryFn: async () => {
    const { data, error } = await db.from("pl_contacts").select("*").eq("list_id", l.id).order("name"); if (error) throw error; return data as Contact[];
  } });
  const [q, setQ] = useState("");
  const shown = contacts.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q.replace(/\D/g, "")));
  async function upd(id: string, patch: Partial<Contact>) {
    if (patch.phone !== undefined) { const n = normalizeBR(patch.phone); if (!n) { toast.error("Telefone inválido"); return; } patch.phone = n; }
    const { error } = await db.from("pl_contacts").update(patch).eq("id", id); if (error) err(error); else refetch();
  }
  async function del(id: string) { await db.from("pl_contacts").delete().eq("id", id); refetch(); onChanged(); }
  async function removeList() {
    if (!confirm(`Excluir a lista "${l.name}" e seus ${l.count} contatos?`)) return;
    const { error } = await db.from("pl_lists").delete().eq("id", l.id); if (error) err(error); else onChanged();
  }
  function exportCsv() {
    const csv = "nome;telefone;observacoes;nao_enviar\n" + contacts.map((c) => [c.name, c.phone, c.notes, c.opted_out ? "sim" : ""].join(";")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `${l.name}.csv`; a.click();
  }
  return (
    <article className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 p-4">
        <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen(!open)}>
          {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
          <div className="min-w-0"><p className="truncate font-semibold">{l.name}</p>
            <p className="text-xs text-muted-foreground">{l.count} contato(s) · {l.source === "grupo" ? "extraído de grupo" : l.source === "csv" ? "importado" : "manual"}</p></div>
        </button>
        {open && <Button size="icon" variant="ghost" aria-label="Exportar" onClick={exportCsv}><Download className="h-4 w-4" /></Button>}
        <Button size="icon" variant="ghost" aria-label="Excluir lista" onClick={removeList}><Trash2 className="h-4 w-4" /></Button>
      </div>
      {open && (
        <div className="border-t p-2">
          <Input className="mb-2" placeholder="Buscar nome ou telefone" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="grid max-h-[28rem] gap-1 overflow-y-auto">
            {shown.length === 0 && <p className="p-2 text-sm text-muted-foreground">Nenhum contato.</p>}
            {shown.map((c) => (
              <div key={c.id} className={`grid grid-cols-[1fr_auto] items-center gap-2 rounded p-2 text-sm sm:grid-cols-[1fr_11rem_auto] ${c.opted_out ? "opacity-50" : ""}`}>
                <Input className="h-8" defaultValue={c.name} placeholder="Nome" onBlur={(e) => e.target.value !== c.name && upd(c.id, { name: e.target.value })} />
                <Input className="col-span-2 h-8 sm:col-span-1" defaultValue={formatBR(c.phone)} onBlur={(e) => normalizeBR(e.target.value) !== c.phone && upd(c.id, { phone: e.target.value })} />
                <div className="col-start-2 row-start-1 flex sm:col-start-auto sm:row-start-auto">
                  <Button size="icon" variant={c.opted_out ? "secondary" : "ghost"} className="h-8 w-8" aria-label="Não enviar" title={c.opted_out ? "Liberar envio" : "Não enviar para este contato"} onClick={() => upd(c.id, { opted_out: !c.opted_out })}><Ban className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Remover" onClick={() => del(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function GroupExtractor({ instances, onDone }: { instances: { name: string; label: string; status: string }[]; onDone: () => void }) {
  const getGroups = useServerFn(plGroups);
  const getMembers = useServerFn(plGroupMembers);
  const [inst, setInst] = useState("");
  const [groups, setGroups] = useState<PlGroup[] | null>(null);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState<{ group: PlGroup; members: (PlMember & { keep: boolean })[]; hidden: number } | null>(null);
  const [dest, setDest] = useState("");
  const { data: lists = [] } = useQuery({ queryKey: ["pl_lists"], queryFn: fetchLists });
  async function loadGroups() {
    if (!inst) { toast.error("Escolha o WhatsApp conectado."); return; }
    setBusy("groups"); try { setGroups(await getGroups({ data: { instance: inst } })); } catch (e) { err(e); } finally { setBusy(""); }
  }
  async function pick(g: PlGroup) {
    setBusy(g.id);
    try { const r = await getMembers({ data: { instance: inst, groupId: g.id } }); setPreview({ group: g, hidden: r.hidden, members: r.members.map((m) => ({ ...m, keep: !m.admin })) }); }
    catch (e) { err(e); } finally { setBusy(""); }
  }
  const editM = (k: number, patch: Partial<PlMember & { keep: boolean }>) => preview && setPreview({ ...preview, members: preview.members.map((m, i) => i === k ? { ...m, ...patch } : m) });
  async function save() {
    if (!preview) return;
    const chosen = preview.members.filter((m) => m.keep);
    if (!chosen.length) { toast.error("Nenhum contato selecionado."); return; }
    setBusy("save");
    try {
      let id = dest;
      if (!id) { const { data: l, error } = await db.from("pl_lists").insert({ name: preview.group.name, source: "grupo" }).select("id").single(); if (error) throw error; id = l.id; }
      const n = await insertContacts(id, chosen);
      toast.success(`${n} contatos salvos.`); setPreview(null); onDone();
    } catch (e) { err(e); } finally { setBusy(""); }
  }
  const connected = instances.filter((i) => i.status === "open");
  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select className="h-10 flex-1 rounded-md border bg-background px-3 text-sm" value={inst} onChange={(e) => { setInst(e.target.value); setGroups(null); }}>
          <option value="">{connected.length ? "Escolha o WhatsApp" : "Nenhum WhatsApp conectado (aba WhatsApp)"}</option>
          {connected.map((i) => <option key={i.name} value={i.name}>{i.label}</option>)}
        </select>
        <Button onClick={loadGroups} disabled={busy === "groups"}><Users className="h-4 w-4" /> {busy === "groups" ? "Carregando..." : "Ver meus grupos"}</Button>
      </div>
      {preview ? (
        <div className="rounded-md border p-3">
          <p className="font-semibold">{preview.group.name}</p>
          <p className="text-sm text-muted-foreground">{preview.members.filter((m) => m.keep).length} de {preview.members.length} selecionados{preview.hidden ? ` · ${preview.hidden} ocultos pelo WhatsApp` : ""}. Administradores vêm desmarcados; seu número foi ignorado.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setPreview({ ...preview, members: preview.members.map((m) => ({ ...m, keep: true })) })}>Marcar todos</Button>
            <Button size="sm" variant="outline" onClick={() => setPreview({ ...preview, members: preview.members.map((m) => ({ ...m, keep: m.keep && !m.admin })) })}><ShieldCheck className="h-4 w-4" /> Tirar administradores</Button>
          </div>
          <div className="mt-2 grid max-h-80 gap-1 overflow-y-auto text-sm">
            {preview.members.map((m, k) => (
              <div key={m.phone} className={`grid grid-cols-[auto_1fr] items-center gap-2 rounded p-1 sm:grid-cols-[auto_1fr_10rem] ${m.keep ? "" : "opacity-50"}`}>
                <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={m.keep} onChange={(e) => editM(k, { keep: e.target.checked })} aria-label="Incluir" />
                <div className="flex min-w-0 items-center gap-2"><Input className="h-8" value={m.name} placeholder="Nome" onChange={(e) => editM(k, { name: e.target.value })} />{m.admin && <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">ADMIN</span>}</div>
                <span className="col-start-2 text-xs text-muted-foreground sm:col-start-auto">{formatBR(m.phone)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={dest} onChange={(e) => setDest(e.target.value)}>
              <option value="">Criar lista "{preview.group.name}"</option>
              {lists.map((l) => <option key={l.id} value={l.id}>Adicionar em: {l.name}</option>)}
            </select>
            <Button onClick={save} disabled={busy === "save"}>Salvar selecionados</Button><Button variant="ghost" onClick={() => setPreview(null)}>Voltar</Button>
          </div>
        </div>
      ) : groups && (
        <div className="rounded-md border">
          <Input className="rounded-b-none border-0 border-b" placeholder={`Filtrar ${groups.length} grupos`} value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="max-h-72 overflow-y-auto">
            {groups.filter((g) => g.name.toLowerCase().includes(filter.toLowerCase())).map((g) => (
              <button key={g.id} className="flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => pick(g)} disabled={!!busy}>
                <span className="truncate">{g.name}</span><span className="shrink-0 text-xs text-muted-foreground">{busy === g.id ? "extraindo..." : `${g.size} membros`}</span>
              </button>
            ))}
            {groups.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nenhum grupo encontrado neste número.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export function ContactsSection({ instances }: { instances: { name: string; label: string; status: string }[] }) {
  const qc = useQueryClient();
  const { data: lists = [], isLoading } = useQuery({ queryKey: ["pl_lists"], queryFn: fetchLists });
  const refresh = () => qc.invalidateQueries({ queryKey: ["pl_lists"] });
  const [mode, setMode] = useState<"grupo" | "csv" | "manual">("grupo");
  const [listName, setListName] = useState("");
  const [target, setTarget] = useState("");
  const [text, setText] = useState("");
  async function importText(source: "csv" | "manual") {
    try {
      const rows = parseLines(text);
      let id = target;
      if (!id) {
        if (!listName.trim()) { toast.error("Dê um nome para a nova lista ou escolha uma existente."); return; }
        const { data, error } = await db.from("pl_lists").insert({ name: listName.trim(), source }).select("id").single();
        if (error) throw error; id = data.id;
      }
      const n = await insertContacts(id, rows);
      toast.success(`${n} contatos adicionados.`); setText(""); setListName(""); refresh(); qc.invalidateQueries({ queryKey: ["pl_contacts", id] });
    } catch (e) { err(e); }
  }
  async function onFile(f: File | undefined) { if (f) { setText(await f.text()); if (!listName) setListName(f.name.replace(/\.\w+$/, "")); } }
  return (
    <div className="grid gap-6">
      <section className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold">Adicionar contatos</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {([["grupo", "Extrair de grupo"], ["csv", "Importar arquivo"], ["manual", "Digitar / colar"]] as const).map(([k, t]) => (
            <Button key={k} size="sm" variant={mode === k ? "default" : "outline"} onClick={() => setMode(k)}>{t}</Button>
          ))}
        </div>
        <div className="mt-4">
          {mode === "grupo" ? <GroupExtractor instances={instances} onDone={refresh} /> : (
            <div className="grid gap-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <select className="h-10 rounded-md border bg-background px-3 text-sm" value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="">Criar nova lista</option>
                  {lists.map((l) => <option key={l.id} value={l.id}>Adicionar em: {l.name}</option>)}
                </select>
                {!target && <Input placeholder="Nome da nova lista" value={listName} onChange={(e) => setListName(e.target.value)} />}
              </div>
              {mode === "csv" && <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground"><Upload className="h-4 w-4" /> Escolher arquivo .csv ou .txt (colunas nome e telefone)<input type="file" accept=".csv,.txt" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} /></label>}
              <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Um contato por linha:\nMaria Souza, (68) 99231-6302\nJoão; +55 68 99999-0000"} />
              <p className="text-xs text-muted-foreground">{parseLines(text).length} linha(s) com telefone reconhecido. Formatos com ou sem +55, DDD e traço são aceitos.</p>
              <Button className="justify-self-start" onClick={() => importText(mode)}><Plus className="h-4 w-4" /> Salvar contatos</Button>
            </div>
          )}
        </div>
      </section>
      <section className="grid gap-3">
        <h2 className="font-semibold">Minhas listas</h2>
        {isLoading && <p className="text-muted-foreground">Carregando...</p>}
        {!isLoading && lists.length === 0 && <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma lista ainda.</p>}
        {lists.map((l) => <ListRow key={l.id} l={l} onChanged={refresh} />)}
      </section>
    </div>
  );
}

/* -------------------------------- Scripts ------------------------------- */

export function MessagesSection() {
  const qc = useQueryClient();
  const { data: scripts = [] } = useQuery({ queryKey: ["pl_scripts"], queryFn: fetchScripts });
  const empty: Script = { id: "", title: "", body: "", message2: "", message3: "", variants: [[], [], []] };
  const [f, setF] = useState<Script>(empty);
  const keys = ["body", "message2", "message3"] as const;
  const vars = (i: number) => f.variants?.[i] ?? [];
  const setVars = (i: number, v: string[]) => { const all = [0, 1, 2].map((k) => (k === i ? v : vars(k))); setF({ ...f, variants: all }); };
  async function save() {
    if (!f.title.trim() || !f.body.trim()) { toast.error("Preencha o nome do bloco e a mensagem 1."); return; }
    const { id, ...row } = f;
    row.variants = [0, 1, 2].map((k) => vars(k).filter((v) => v.trim()));
    const { error } = id ? await db.from("pl_scripts").update(row).eq("id", id) : await db.from("pl_scripts").insert(row);
    if (error) { err(error); return; }
    toast.success("Bloco de mensagens salvo."); setF(empty); qc.invalidateQueries({ queryKey: ["pl_scripts"] });
  }
  async function del(id: string) { if (!confirm("Excluir bloco de mensagens?")) return; await db.from("pl_scripts").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["pl_scripts"] }); }
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <section className="grid content-start gap-4 rounded-lg border bg-card p-4">
        <h2 className="font-semibold">{f.id ? "Editar bloco" : "Novo bloco de mensagens"}</h2>
        <Input placeholder="Nome do bloco (ex.: Reativação de clientes)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        {keys.map((k, i) => (
          <div key={k} className="grid gap-2 rounded-md border p-3">
            <Label>Mensagem {i + 1}{i ? " (opcional)" : ""}</Label>
            <Textarea rows={i ? 3 : 4} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={i ? "Mensagem seguinte da sequência" : "Oi {nome}, tudo bem? Vi que você está no grupo {lista}..."} />
            {vars(i).map((v, n) => (
              <div key={n} className="flex gap-2">
                <Textarea rows={2} value={v} onChange={(e) => setVars(i, vars(i).map((x, m) => (m === n ? e.target.value : x)))} placeholder={`Variação ${n + 2} — mesma ideia com outras palavras`} />
                <Button size="icon" variant="ghost" aria-label="Remover variação" onClick={() => setVars(i, vars(i).filter((_, m) => m !== n))}><X className="h-4 w-4" /></Button>
              </div>
            ))}
            {(f[k].trim() || vars(i).length > 0) && <Button size="sm" variant="outline" className="justify-self-start" onClick={() => setVars(i, [...vars(i), ""])}><Shuffle className="h-4 w-4" /> Adicionar variação</Button>}
          </div>
        ))}
        <p className="text-xs text-muted-foreground">A cada contato o sistema sorteia uma das variações de cada mensagem, para os textos não saírem idênticos. Marcadores: {"{nome}"} (primeiro nome) e {"{lista}"} (nome da lista ou grupo).</p>
        <div className="flex gap-2"><Button onClick={save}>Salvar bloco</Button>{f.id && <Button variant="ghost" onClick={() => setF(empty)}>Cancelar</Button>}</div>
      </section>
      <section className="grid content-start gap-3">
        <h2 className="font-semibold">Blocos salvos</h2>
        {scripts.length === 0 && <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum bloco ainda.</p>}
        {scripts.map((s) => (
          <article key={s.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start gap-2"><p className="flex-1 font-semibold">{s.title}</p>
              <Button size="sm" variant="ghost" onClick={() => setF({ ...s, variants: s.variants ?? [[], [], []] })}>Editar</Button>
              <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => del(s.id)}><Trash2 className="h-4 w-4" /></Button></div>
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{s.body}</p>
            <p className="mt-1 text-xs text-muted-foreground">{slots(s).filter((x) => x.length).length} mensagem(ns) · {slots(s).reduce((a, x) => a + Math.max(0, x.length - 1), 0)} variação(ões)</p>
          </article>
        ))}
      </section>
    </div>
  );
}

/* ------------------------------- Campanhas ------------------------------ */

function buildSchedule(n: number, c: { start: Date; daily: number; minGap: number; maxGap: number; ws: number; we: number; weekdays: boolean }) {
  const out: Date[] = [];
  const perDay = new Map<string, number>();
  let t = new Date(c.start);
  const toWindow = (d: Date) => {
    for (let guard = 0; guard < 400; guard++) {
      const key = d.toDateString();
      const wd = d.getDay();
      const okDay = !c.weekdays || (wd !== 0 && wd !== 6);
      if (okDay && (perDay.get(key) ?? 0) < c.daily && d.getHours() >= c.ws && d.getHours() < c.we) return d;
      if (okDay && d.getHours() < c.ws && (perDay.get(key) ?? 0) < c.daily) { d = new Date(d); d.setHours(c.ws, Math.floor(Math.random() * 20), 0, 0); continue; }
      d = new Date(d); d.setDate(d.getDate() + 1); d.setHours(c.ws, Math.floor(Math.random() * 20), 0, 0);
    }
    return d;
  };
  for (let i = 0; i < n; i++) {
    t = toWindow(t);
    out.push(new Date(t));
    perDay.set(t.toDateString(), (perDay.get(t.toDateString()) ?? 0) + 1);
    t = new Date(t.getTime() + (c.minGap + Math.random() * Math.max(0, c.maxGap - c.minGap)) * 60000);
  }
  return out;
}

const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j]!, b[i]!]; } return b; };
const pickOne = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;
// distribui as variações por igual (rodízio em ordem embaralhada) para nenhuma se repetir demais
const rotation = (sl: string[][]) => { const orders = sl.map((x) => shuffle(x.map((_, i) => i))); return (k: number) => sl.map((x, j) => x[orders[j]![k % x.length]!]!); };
const fill = (tpl: string, name: string, list: string) => tpl.replace(/\{nome\}/gi, name.split(" ")[0] ?? "").replace(/\{lista\}|\{grupo\}/gi, list).replace(/ +,/g, ",").trim();

const STEPS = ["Campanha", "Público", "Mensagens", "Ritmo e agenda", "Revisão"];

function NewCampaign({ instances, onClose, onDone }: { instances: { name: string; label: string; status: string }[]; onClose: () => void; onDone: () => void }) {
  const { data: lists = [] } = useQuery({ queryKey: ["pl_lists"], queryFn: fetchLists });
  const { data: scripts = [] } = useQuery({ queryKey: ["pl_scripts"], queryFn: fetchScripts });
  const now = new Date(Date.now() + 10 * 60000);
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ name: "", list: "", script: "", instance: "", all: true, max: 10, order: "aleatoria" as "lista" | "aleatoria", daily: 3, minGap: 40, maxGap: 120, ws: 9, we: 18, weekdays: true, start: local, pack: false, now: false });
  const [busy, setBusy] = useState(false);
  const [seed, setSeed] = useState(0);
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const list = lists.find((l) => l.id === f.list);
  const script = scripts.find((s) => s.id === f.script);
  const total = f.pack ? TEST_PACK.length : list ? (f.all ? list.count : Math.min(f.max, list.count)) : 0;
  const days = Math.ceil(total / Math.max(1, f.daily));
  const listName = f.pack ? TEST_PACK_NAME : list?.name ?? "sua lista";
  const preview = useMemo(() => (script ? slots(script).filter((x) => x.length).map((x) => fill(pickOne(x), "Maria Souza", listName)) : []), [script, listName, seed]);
  const valid = [!!f.name.trim() && !!f.instance, f.pack || (!!list && total > 0), !!script, f.we > f.ws, true];
  const wake = useServerFn(plWake);
  const planCfg = f.now
    ? { start: new Date(Date.now() + 30000), daily: 9999, minGap: f.minGap, maxGap: Math.max(f.minGap, f.maxGap), ws: 0, we: 24, weekdays: false }
    : { start: new Date(f.start), daily: Math.max(1, f.daily), minGap: f.minGap, maxGap: Math.max(f.minGap, f.maxGap), ws: f.ws, we: f.we, weekdays: f.weekdays };
  const plan = useMemo(() => (total ? buildSchedule(total, planCfg) : []), [JSON.stringify(planCfg), total]);
  async function publish() {
    if (valid.some((v) => !v)) { toast.error("Revise as etapas incompletas."); return; }
    setBusy(true);
    try {
      let pool: Contact[];
      if (f.pack) {
        pool = TEST_PACK.map((t, i) => ({ id: `pack-${i}`, name: t.name, phone: t.phone }) as Contact);
      } else {
        const { data: contacts, error: ce } = await db.from("pl_contacts").select("*").eq("list_id", list!.id).eq("opted_out", false).order("created_at");
        if (ce) throw ce;
        pool = (contacts ?? []) as Contact[];
        if (f.order === "aleatoria") pool = shuffle(pool);
        if (!f.all) pool = pool.slice(0, f.max);
      }
      if (!pool.length) throw new Error("A lista não tem contatos liberados para envio.");
      const sl = slots(script!).filter((x) => x.length);
      const { data: camp, error } = await db.from("pl_campaigns").insert({
        name: f.name.trim(), list_id: f.pack ? null : list!.id, script_id: script!.id, instance: f.instance, texts: sl.map((x) => x[0]!), daily_limit: Math.max(1, f.daily), max_contacts: f.pack || f.all ? null : f.max,
        min_gap_min: f.minGap, max_gap_min: Math.max(f.minGap, f.maxGap), window_start: f.ws, window_end: f.we, weekdays_only: f.weekdays, start_at: planCfg.start.toISOString(),
      }).select("id").single();
      if (error) throw error;
      const when = plan.length >= pool.length ? plan : buildSchedule(pool.length, planCfg);
      const rot = rotation(sl);
      const rows = pool.map((c, i) => ({ campaign_id: camp.id, contact_id: f.pack ? null : c.id, name: c.name, phone: c.phone, texts: rot(i).map((t) => fill(t, c.name, listName)), send_at: when[i]!.toISOString() }));
      for (let i = 0; i < rows.length; i += 500) { const { error: qe } = await db.from("pl_queue").insert(rows.slice(i, i + 500)); if (qe) throw qe; }
      try { await wake(); } catch { /* a rodada fixa continua valendo */ }
      toast.success(`Campanha publicada: ${rows.length} contatos programados.`); onDone();
    } catch (e) { err(e); } finally { setBusy(false); }
  }
  const sel = "h-11 w-full rounded-md border bg-background px-3 text-sm";
  const num = (k: keyof typeof f, min: number, max: number) => <NumField value={Number(f[k])} min={min} max={max} onChange={(n) => set({ [k]: n } as Partial<typeof f>)} />;
  const box = (title: string, desc: string, body: ReactNode) => <section className="rounded-lg border bg-card p-5"><h3 className="font-semibold">{title}</h3><p className="mb-4 text-sm text-muted-foreground">{desc}</p>{body}</section>;
  const summary: [string, string][] = [
    ["Campanha", f.name || "—"], ["WhatsApp", instances.find((i) => i.name === f.instance)?.label ?? "—"],
    ["Lista", f.pack ? `${TEST_PACK_NAME} · ${TEST_PACK.length} números seus` : list ? `${list.name} · ${total} contato(s)${f.order === "aleatoria" ? " em ordem aleatória" : ""}` : "—"],
    ["Mensagens", script ? `${script.title} · ${preview.length} mensagem(ns)` : "—"],
    ["Ritmo", f.now ? `Começa agora · ${f.minGap}–${f.maxGap} min entre contatos` : `${f.daily}/dia · ${f.minGap}–${f.maxGap} min entre contatos · ${ampm(f.ws)} às ${ampm(f.we)}${f.weekdays ? " · seg a sex" : ""}`],
    ["Primeiro envio", plan[0] ? fmtWhen(plan[0]) : "—"],
    ["Duração", total ? `cerca de ${days} dia(s) de envio` : "—"],
  ];
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <Button size="icon" variant="ghost" aria-label="Fechar" onClick={onClose}><X className="h-5 w-5" /></Button>
        <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase text-primary">Papa Lead · Nova campanha</p><p className="truncate font-semibold">{f.name || "Campanha sem nome"}</p></div>
        <Button onClick={publish} disabled={busy || valid.some((v) => !v)} className="hidden sm:inline-flex"><Rocket className="h-4 w-4" /> {busy ? "Publicando..." : "Publicar"}</Button>
      </header>
      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-60 shrink-0 border-r p-3 md:block">
          {STEPS.map((t, i) => (
            <button key={t} onClick={() => setStep(i)} className={`mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${step === i ? "bg-primary/15 font-semibold text-primary" : "hover:bg-muted"}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${valid[i] && i < 4 ? "border-primary bg-primary text-primary-foreground" : ""}`}>{valid[i] && i < 4 ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>{t}
            </button>
          ))}
        </nav>
        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="mx-auto grid max-w-3xl gap-4">
            <p className="text-sm text-muted-foreground md:hidden">Etapa {step + 1} de {STEPS.length} · {STEPS[step]}</p>
            {step === 0 && <>
              {box("Nome da campanha", "Use um nome fácil de reconhecer na lista de campanhas.", <Input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: Reativação outubro" />)}
              {box("WhatsApp de envio", "O número conectado que vai disparar as mensagens.", <select className={sel} value={f.instance} onChange={(e) => set({ instance: e.target.value })}>
                <option value="">Escolha</option>{instances.map((i) => <option key={i.name} value={i.name}>{i.label}{i.status !== "open" ? " (desconectado)" : ""}</option>)}</select>)}
            </>}
            {step === 1 && <>
              {box("Público", `Use o ${TEST_PACK_NAME} para testar os disparos com os seus próprios números, ou escolha uma lista de contatos.`, <div className="grid gap-3">
                <label className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm"><Switch checked={f.pack} onCheckedChange={(v) => set({ pack: v })} /> <span><b>{TEST_PACK_NAME}</b> · {TEST_PACK.length} números seus ({TEST_PACK.map((t) => t.phone).join(", ")})</span></label>
                {!f.pack && <select className={sel} value={f.list} onChange={(e) => set({ list: e.target.value })}>
                 <option value="">Escolha a lista</option>{lists.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.count})</option>)}</select>}
              </div>)}
              {!f.pack && box("Quantos contatos abordar", "Envie para a lista inteira ou só para uma parte dela.", <div className="grid gap-3">
                <div className="flex flex-wrap gap-2"><Button variant={f.all ? "default" : "outline"} onClick={() => set({ all: true })}>Todos ({list?.count ?? 0})</Button><Button variant={!f.all ? "default" : "outline"} onClick={() => set({ all: false })}>Quantidade definida</Button></div>
                {!f.all && <div className="grid max-w-xs gap-1"><Label>Número de contatos</Label>{num("max", 1, 100000)}</div>}
              </div>)}
              {!f.pack && box("Ordem de envio", "Aleatória mistura a lista para não seguir a ordem do grupo.", <div className="flex flex-wrap gap-2">
                <Button variant={f.order === "lista" ? "default" : "outline"} onClick={() => set({ order: "lista" })}>Ordem da lista</Button>
                <Button variant={f.order === "aleatoria" ? "default" : "outline"} onClick={() => set({ order: "aleatoria" })}><Shuffle className="h-4 w-4" /> Aleatória</Button></div>)}
            </>}
            {step === 2 && <>
              {box("Bloco de mensagens", "As variações são sorteadas para cada contato.", <select className={sel} value={f.script} onChange={(e) => set({ script: e.target.value })}>
                <option value="">Escolha</option>{scripts.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select>)}
              {script && box("Prévia", "Exemplo do que um contato pode receber.", <div className="grid gap-2">
                {preview.map((t, i) => <p key={i} className="max-w-md whitespace-pre-wrap rounded-lg rounded-tl-none bg-primary/15 p-3 text-sm">{t}</p>)}
                <Button size="sm" variant="outline" className="justify-self-start" onClick={() => setSeed(seed + 1)}><Shuffle className="h-4 w-4" /> Sortear outra variação</Button></div>)}
            </>}
            {step === 3 && <>
              {box("Configuração recomendada", "3 contatos por dia, 40–120 min entre eles, das 9 AM às 6 PM, só de segunda a sexta.", <Button variant="outline" onClick={() => set({ daily: 3, minGap: 40, maxGap: 120, ws: 9, we: 18, weekdays: true })}><ShieldCheck className="h-4 w-4" /> Aplicar configuração segura</Button>)}
              {box("Começar agora", "Dispara em instantes, sem esperar horário, dias ou limite diário. Só respeita os intervalos entre contatos.", <label className="flex items-center gap-2 text-sm"><Switch checked={f.now} onCheckedChange={(v) => set({ now: v })} /> Começar a disparar agora</label>)}
              {!f.now && box("Quando começar", "Dia e hora do primeiro envio.", <WhenPicker value={f.start} onChange={(v) => set({ start: v })} />)}
              {!f.now && box("Horário permitido", "O robô só manda dentro desse horário. Fora dele, espera o próximo dia permitido.", <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1"><Label>A partir das</Label><HourSelect value={f.ws} min={0} max={23} onChange={(v) => set({ ws: v })} /></div>
                  <div className="grid gap-1"><Label>Até as</Label><HourSelect value={f.we} min={1} max={24} onChange={(v) => set({ we: v })} /></div></div>
                <label className="flex items-center gap-2 text-sm"><Switch checked={f.weekdays} onCheckedChange={(v) => set({ weekdays: v })} /> Só de segunda a sexta</label>
                {f.we <= f.ws && <p className="text-sm text-destructive">O horário final deve ser depois do inicial.</p>}</div>)}
              {box("Ritmo", "Quando atinge o limite do dia, o robô continua no dia seguinte.", <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="grid gap-1"><Label>Contatos por dia</Label>{num("daily", 1, 200)}</div>
                <div className="grid gap-1"><Label>Esperar no mínimo (min)</Label>{num("minGap", 1, 600)}</div>
                <div className="grid gap-1"><Label>Esperar no máximo (min)</Label>{num("maxGap", 1, 600)}</div></div>)}
              {box("Como vai ficar", "Prévia dos horários com essas regras.", <SchedulePreview times={plan} />)}
            </>}
            {step === 4 && box("Revisão", "Confira tudo antes de publicar.", <div className="grid gap-2 text-sm">
              {summary.map(([k, v], i) => <div key={k} className="flex flex-wrap justify-between gap-2 border-b pb-2"><span className="text-muted-foreground">{k}</span><span className={`text-right font-medium ${i < 4 && !valid[i === 0 || i === 1 ? 0 : i - 1] ? "text-destructive" : ""}`}>{v}</span></div>)}
            </div>)}
          </div>
        </main>
      </div>
      <footer className="flex items-center justify-between gap-2 border-t px-4 py-3">
        <Button variant="outline" onClick={() => (step ? setStep(step - 1) : onClose())}><ArrowLeft className="h-4 w-4" /> {step ? "Voltar" : "Cancelar"}</Button>
        {step < STEPS.length - 1
          ? <Button onClick={() => setStep(step + 1)}>Avançar <ArrowRight className="h-4 w-4" /></Button>
          : <Button onClick={publish} disabled={busy || valid.some((v) => !v)}><Rocket className="h-4 w-4" /> {busy ? "Publicando..." : "Publicar campanha"}</Button>}
      </footer>
    </div>
  );
}

function EditCampaign({ c, rows, instances, onClose, onDone }: { c: Campaign; rows: QueueRow[]; instances: { name: string; label: string; status: string }[]; onClose: () => void; onDone: () => void }) {
  const { data: lists = [] } = useQuery({ queryKey: ["pl_lists"], queryFn: fetchLists });
  const { data: scripts = [] } = useQuery({ queryKey: ["pl_scripts"], queryFn: fetchScripts });
  const wake = useServerFn(plWake);
  const pend = rows.filter((r) => r.status === "pendente").sort((a, b) => a.send_at.localeCompare(b.send_at));
  const firstPend = pend[0] ? new Date(Math.max(Date.now() + 5 * 60000, new Date(pend[0].send_at).getTime())) : new Date(Date.now() + 5 * 60000);
  const [f, setF] = useState({ name: c.name, instance: c.instance, script: c.script_id ?? "", daily: c.daily_limit, minGap: c.min_gap_min, maxGap: c.max_gap_min, ws: c.window_start, we: c.window_end, weekdays: c.weekdays_only, start: toLocalInput(firstPend), resort: false });
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const script = scripts.find((s) => s.id === f.script);
  const scriptChanged = !!script && (f.script !== c.script_id || f.resort);
  const num = (k: "daily" | "minGap" | "maxGap", min: number, max: number) => <NumField value={Number(f[k])} min={min} max={max} onChange={(n) => set({ [k]: n })} />;
  const cfg = { start: new Date(f.start), daily: Math.max(1, Number(f.daily) || 1), minGap: Math.max(1, Number(f.minGap) || 1), maxGap: Math.max(Number(f.minGap) || 1, Number(f.maxGap) || 1), ws: f.ws, we: f.we, weekdays: f.weekdays };
  const plan = useMemo(() => (f.we > f.ws ? buildSchedule(pend.length, cfg) : []), [JSON.stringify(cfg), pend.length]);
  const preview = useMemo(() => (script ? slots(script).filter((x) => x.length).map((x) => x[0]!) : c.texts), [script, c.texts]);
  async function save() {
    if (!f.name.trim() || !f.instance) { toast.error("Preencha nome e WhatsApp."); return; }
    if (f.we <= f.ws) { toast.error("O horário final deve ser depois do inicial."); return; }
    setBusy(true);
    try {
      const sl = script ? slots(script).filter((x) => x.length) : [];
      if (scriptChanged && !sl.length) throw new Error("O bloco de mensagens escolhido está vazio.");
      const patch: Record<string, unknown> = { name: f.name.trim(), instance: f.instance, daily_limit: cfg.daily, min_gap_min: cfg.minGap, max_gap_min: cfg.maxGap, window_start: f.ws, window_end: f.we, weekdays_only: f.weekdays, start_at: cfg.start.toISOString() };
      if (scriptChanged) { patch["script_id"] = script!.id; patch["texts"] = sl.map((x) => x[0]!); }
      const { error } = await db.from("pl_campaigns").update(patch).eq("id", c.id);
      if (error) throw error;
      const listName = lists.find((l) => l.id === c.list_id)?.name ?? "";
      const when = buildSchedule(pend.length, { ...cfg, start: new Date(Math.max(Date.now() + 60000, cfg.start.getTime())) });
      const rot = rotation(sl);
      for (let i = 0; i < pend.length; i++) {
        const r = pend[i]!;
        const up: Record<string, unknown> = { send_at: when[i]!.toISOString() };
        if (scriptChanged) up["texts"] = rot(i).map((t) => fill(t, r.name, listName));
        const { error: qe } = await db.from("pl_queue").update(up).eq("id", r.id).eq("status", "pendente");
        if (qe) throw qe;
      }
      try { await wake(); } catch { /* a rodada fixa continua valendo */ }
      toast.success(pend.length ? `Campanha atualizada. ${pend.length} envio(s) reprogramado(s).` : "Campanha atualizada.");
      onDone();
    } catch (e) { err(e); } finally { setBusy(false); }
  }
  const box = (title: string, desc: string, body: ReactNode) => <section className="grid gap-3 rounded-lg border bg-card p-5"><div><h3 className="font-semibold">{title}</h3><p className="text-sm text-muted-foreground">{desc}</p></div>{body}</section>;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <Button size="icon" variant="ghost" aria-label="Fechar" onClick={onClose}><X className="h-5 w-5" /></Button>
        <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase text-primary">Papa Lead · Editar campanha</p><p className="truncate font-semibold">{f.name || "Campanha"}</p></div>
        <Button onClick={save} disabled={busy}><Check className="h-4 w-4" /> {busy ? "Salvando..." : "Salvar"}</Button>
      </header>
      <main className="flex-1 overflow-y-auto p-4 sm:p-8"><div className="mx-auto grid max-w-3xl gap-4">
        {box("1. Campanha", "Nome e número que dispara.", <>
          <div className="grid gap-1"><Label>Nome</Label><Input value={f.name} onChange={(e) => set({ name: e.target.value })} /></div>
          <div className="grid gap-1"><Label>WhatsApp de envio</Label><select className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={f.instance} onChange={(e) => set({ instance: e.target.value })}>
            {instances.map((i) => <option key={i.name} value={i.name}>{i.label}{i.status !== "open" ? " (desconectado)" : ""}</option>)}</select></div></>)}
        {box("2. Mensagens", `Troque o bloco de mensagens. Vale para os ${pend.length} contato(s) que ainda não receberam.`, <>
          <select className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={f.script} onChange={(e) => set({ script: e.target.value })}>
            <option value="">Manter as mensagens atuais</option>{scripts.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select>
          {script && f.script === c.script_id && <label className="flex items-center gap-2 text-sm"><Switch checked={f.resort} onCheckedChange={(v) => set({ resort: v })} /> Aplicar de novo este bloco (use se você editou os textos dele)</label>}
          <div className="grid gap-2">{preview.map((t, i) => <p key={i} className="max-w-md whitespace-pre-wrap rounded-lg rounded-tl-none bg-primary/15 p-3 text-sm"><span className="mb-1 block text-xs font-semibold text-primary">Mensagem {i + 1}</span>{t}</p>)}</div>
          {scriptChanged && <p className="text-xs text-primary">Ao salvar, os contatos que faltam vão receber o novo bloco (com as variações sorteadas).</p>}</>)}
        {box("3. Quando enviar", "Escolha o dia e a hora do próximo envio e em que horário do dia o robô pode mandar.", <>
          <div className="grid gap-1"><Label>Próximo envio a partir de</Label><WhenPicker value={f.start} onChange={(v) => set({ start: v })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Pode enviar a partir das</Label><HourSelect value={f.ws} min={0} max={23} onChange={(v) => set({ ws: v })} /></div>
            <div className="grid gap-1"><Label>Até as</Label><HourSelect value={f.we} min={1} max={24} onChange={(v) => set({ we: v })} /></div></div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={f.weekdays} onCheckedChange={(v) => set({ weekdays: v })} /> Só de segunda a sexta</label>
          {f.we <= f.ws && <p className="text-sm text-destructive">O horário final deve ser depois do inicial.</p>}</>)}
        {box("4. Ritmo", "Quantos contatos por dia e quanto esperar entre um contato e outro.", <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="grid gap-1"><Label>Contatos por dia</Label>{num("daily", 1, 200)}</div>
          <div className="grid gap-1"><Label>Esperar no mínimo (min)</Label>{num("minGap", 1, 600)}</div>
          <div className="grid gap-1"><Label>Esperar no máximo (min)</Label>{num("maxGap", 1, 600)}</div></div>)}
        {box("Como vai ficar", "Prévia dos horários dos próximos envios com essas regras.", <SchedulePreview times={plan} />)}
      </div></main>
    </div>
  );
}

export const ampm = (h: number) => (h === 0 || h === 24 ? "12 AM (meia-noite)" : h === 12 ? "12 PM (meio-dia)" : h < 12 ? `${h} AM` : `${h - 12} PM`);
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
export const fmtWhen = (v: string | Date) => {
  const d = new Date(v); const h = d.getHours();
  return `${d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })} · ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

export function HourSelect({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min: number; max: number }) {
  return <select className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={value} onChange={(e) => onChange(Number(e.target.value))}>
    {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((h) => <option key={h} value={h}>{ampm(h)}</option>)}</select>;
}

export function WhenPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [d = "", t = "09:00"] = value.split("T");
  const [H = 9, M = 0] = t.split(":").map(Number);
  const h12 = H % 12 || 12, pm = H >= 12;
  const emit = (date: string, hh: number, mm: number, isPm: boolean) => onChange(`${date}T${String((hh % 12) + (isPm ? 12 : 0)).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  const sel = "h-11 rounded-md border bg-background px-2 text-sm";
  return (
    <div className="flex flex-wrap gap-2">
      <Input type="date" className="w-auto min-w-40" value={d} onChange={(e) => e.target.value && emit(e.target.value, h12, M, pm)} />
      <div className="flex items-center gap-1">
        <select className={sel} aria-label="Hora" value={h12} onChange={(e) => emit(d, Number(e.target.value), M, pm)}>{Array.from({ length: 12 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{h}</option>)}</select>
        <span>:</span>
        <select className={sel} aria-label="Minuto" value={M} onChange={(e) => emit(d, h12, Number(e.target.value), pm)}>{Array.from({ length: 60 }, (_, i) => i).map((m) => <option key={m} value={m}>{String(m).padStart(2, "0")}</option>)}</select>
        <select className={sel} aria-label="AM ou PM" value={pm ? "PM" : "AM"} onChange={(e) => emit(d, h12, M, e.target.value === "PM")}><option value="AM">AM</option><option value="PM">PM</option></select>
      </div>
    </div>
  );
}

function SchedulePreview({ times }: { times: Date[] }) {
  if (!times.length) return <p className="text-sm text-muted-foreground">Nenhum envio aguardando.</p>;
  const show = times.slice(0, 6);
  return (
    <div className="grid gap-1 text-sm">
      {show.map((t, i) => <div key={i} className="flex justify-between border-b pb-1"><span className="text-muted-foreground">Contato {i + 1}</span><span className="font-medium">{fmtWhen(t)}</span></div>)}
      {times.length > 6 && <div className="flex justify-between pt-1"><span className="text-muted-foreground">Último (contato {times.length})</span><span className="font-medium">{fmtWhen(times[times.length - 1]!)}</span></div>}
      <p className="pt-1 text-xs text-muted-foreground">Os minutos variam um pouco de propósito, para parecer natural. O envio pode chegar até 1–2 min depois do horário.</p>
    </div>
  );
}

function campaignRisk(c: Campaign, fail: number, sent: number, variations: number, total: number) {
  let score = 0; const tips: string[] = [];
  if (c.daily_limit > 30) { score += 35; tips.push("Mais de 30 contatos por dia é arriscado; o recomendado é até 15."); }
  else if (c.daily_limit > 15) { score += 18; tips.push("Acima de 15 contatos por dia aumenta o risco."); }
  if (c.min_gap_min < 10) { score += 30; tips.push("Intervalo mínimo abaixo de 10 min parece robô."); }
  else if (c.min_gap_min < 30) { score += 12; tips.push("Intervalos de 40–120 min são os mais seguros."); }
  if (total > 3 && variations <= 1) { score += 20; tips.push("Todas as mensagens são iguais; crie variações no bloco."); }
  if (!c.weekdays_only) score += 5;
  if (c.window_start < 8 || c.window_end > 20) { score += 10; tips.push("Enviar fora do horário comercial gera mais denúncias."); }
  if (sent + fail >= 3 && fail / (sent + fail) > 0.2) { score += 20; tips.push("Muitas falhas: confira os números e a conexão."); }
  score = Math.min(100, score);
  return { score, tips, level: score >= 50 ? "alto" : score >= 25 ? "moderado" : "baixo" };
}

function CampaignRow({ c, rows, instances, onChanged }: { c: Campaign; rows: QueueRow[]; instances: { name: string; label: string; status: string }[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const dispatchNow = useServerFn(plDispatchNow);
  const wake = useServerFn(plWake);
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const sent = count("enviada"), fail = count("falhou"), pend = count("pendente") + count("enviando"), total = rows.length;
  const replied = rows.filter((r) => r.replied).length;
  const rate = sent ? Math.round((replied / sent) * 100) : 0;
  const delivery = sent + fail ? Math.round((sent / (sent + fail)) * 100) : 100;
  const variations = new Set(rows.map((r) => (r.texts ?? []).join("|"))).size;
  const risk = campaignRisk(c, fail, sent, variations, rows.length);
  async function markReplied(r: QueueRow) { const { error } = await db.from("pl_queue").update({ replied: !r.replied }).eq("id", r.id); if (error) err(error); else onChanged(); }
  const next = rows.filter((r) => r.status === "pendente").sort((a, b) => a.send_at.localeCompare(b.send_at))[0];
  async function toggle() { const { error } = await db.from("pl_campaigns").update({ status: c.status === "ativa" ? "pausada" : "ativa" }).eq("id", c.id); if (error) err(error); else onChanged(); }
  async function del() { if (!confirm(`Excluir a campanha "${c.name}" e cancelar envios pendentes?`)) return; await db.from("pl_campaigns").delete().eq("id", c.id); onChanged(); }
  async function retry() { await db.from("pl_queue").update({ status: "pendente", error: null, send_at: new Date(Date.now() + 60000).toISOString() }).eq("campaign_id", c.id).eq("status", "falhou"); onChanged(); }
  async function startNow() {
    const pendRows = rows.filter((r) => r.status === "pendente").sort((a, b) => a.send_at.localeCompare(b.send_at));
    if (!pendRows.length) { toast.info("Não há envios aguardando nesta campanha."); return; }
    if (!confirm(`Antecipar ${pendRows.length} envio(s) para começar agora? Eles saem em sequência, respeitando o intervalo mínimo de ${c.min_gap_min} min.`)) return;
    const gap = Math.max(1, c.min_gap_min) * 60000;
    const t0 = Date.now() + 30000;
    for (let i = 0; i < pendRows.length; i++) {
      const { error } = await db.from("pl_queue").update({ send_at: new Date(t0 + i * gap).toISOString() }).eq("id", pendRows[i]!.id).eq("status", "pendente");
      if (error) { err(error); return; }
    }
    if (c.status !== "ativa") await db.from("pl_campaigns").update({ status: "ativa" }).eq("id", c.id);
    toast.success("Enviando o primeiro agora..."); onChanged();
    setTimeout(async () => { try { await dispatchNow(); await wake(); } catch { /* o agendador tenta de novo na próxima rodada */ } onChanged(); }, 31000);
  }
  const label: Record<string, string> = { pendente: "Aguardando", enviando: "Enviando", enviada: "Enviada", falhou: "Falhou" };
  return (
    <article className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen(!open)}>
          {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
          <div className="min-w-0"><p className="truncate font-semibold">{c.name}</p>
            <p className="text-xs text-muted-foreground">{c.status === "ativa" ? (pend ? "Ativa" : "Concluída") : "Pausada"} · {c.daily_limit}/dia · {ampm(c.window_start)}–{ampm(c.window_end)}{next ? ` · próximo ${fmtWhen(next.send_at)}` : ""}</p></div>
        </button>
        <div className="flex gap-4 text-center text-xs">
          <div><p className="text-lg font-bold">{sent}</p>enviadas</div>
          <div><p className="text-lg font-bold">{pend}</p>faltam</div>
          <div><p className={`text-lg font-bold ${fail ? "text-destructive" : ""}`}>{fail}</p>falhas</div>
        </div>
        <div className="flex">
          <Button size="icon" variant="ghost" aria-label={c.status === "ativa" ? "Pausar" : "Retomar"} onClick={toggle}>{c.status === "ativa" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
          <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" aria-label="Excluir" onClick={del}><Trash2 className="h-4 w-4" /></Button>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded bg-muted"><div className="h-full bg-primary" style={{ width: `${total ? ((sent + fail) / total) * 100 : 0}%` }} /></div>
      </div>
      {editing && <EditCampaign c={c} rows={rows} instances={instances} onClose={() => setEditing(false)} onDone={() => { setEditing(false); onChanged(); }} />}
      {open && (
        <div className="border-t p-2">
          <div className="mb-2 flex flex-wrap gap-2">
            {pend > 0 && <Button size="sm" onClick={startNow}><Zap className="h-4 w-4" /> Começar agora</Button>}
            {fail > 0 && <Button size="sm" variant="outline" onClick={retry}>Tentar falhas de novo</Button>}
          </div>
          <div className="mb-2 grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
            {([["Total", total], ["Chegaram", sent], ["Responderam", `${replied} (${rate}%)`], ["Entrega", `${delivery}%`], ["Variações", variations]] as [string, string | number][]).map(([k, v]) => (
              <div key={k} className="rounded-md bg-muted p-2"><p className="text-base font-bold">{v}</p><p className="text-xs text-muted-foreground">{k}</p></div>))}
          </div>
          <div className={`mb-2 rounded-md border p-3 text-sm ${risk.level === "alto" ? "border-destructive/50 bg-destructive/10" : risk.level === "moderado" ? "border-primary/50 bg-primary/10" : ""}`}>
            <p className="font-semibold">Risco de bloqueio: {risk.level === "alto" ? "Alto" : risk.level === "moderado" ? "Moderado" : "Baixo"} ({risk.score}/100)</p>
            {risk.tips.length > 0 ? <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">{risk.tips.map((t) => <li key={t}>{t}</li>)}</ul> : <p className="text-xs text-muted-foreground">Ritmo dentro do recomendado.</p>}
            <p className="mt-1 text-[11px] text-muted-foreground">Estimativa baseada no ritmo, nas variações e nas falhas; o WhatsApp não informa o risco real.</p>
          </div>
          <p className="mb-1 px-2 text-xs text-muted-foreground">"Chegaram" = aceitas pelo WhatsApp. Toque no ícone de resposta quando o contato responder.</p>
          <div className="grid max-h-96 gap-1 overflow-y-auto text-sm">
            {[...rows].sort((a, b) => a.send_at.localeCompare(b.send_at)).map((r) => (
              <div key={r.id} className="grid grid-cols-[1fr_auto] gap-x-2 rounded p-2 hover:bg-muted sm:grid-cols-[1fr_9rem_8rem_6rem]">
                <span className="truncate">{r.name || "—"}</span>
                <span className="text-muted-foreground">{formatBR(r.phone)}</span>
                <span className="text-xs text-muted-foreground">{fmtWhen(r.sent_at ?? r.send_at)}</span>
                <span className="flex items-center gap-1"><button aria-label="Marcar respondeu" title={r.replied ? "Respondeu (tocar para desmarcar)" : "Marcar que respondeu"} disabled={r.status !== "enviada"} onClick={() => markReplied(r)} className={`rounded p-0.5 disabled:opacity-30 ${r.replied ? "text-primary" : "text-muted-foreground"}`}><MessageSquareReply className="h-3.5 w-3.5" /></button><span className={`text-xs ${r.status === "falhou" ? "text-destructive" : r.status === "enviada" ? "text-primary" : ""}`} title={r.error ?? ""}>{r.replied ? "Respondeu" : label[r.status] ?? r.status}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export function CampaignsSection({ instances }: { instances: { name: string; label: string; status: string }[] }) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const { data, dataUpdatedAt, isFetching } = useQuery({ queryKey: ["pl_campaigns"], queryFn: async () => {
    const [{ data: cs, error }, { data: qs, error: qe }] = await Promise.all([
      db.from("pl_campaigns").select("*").order("created_at", { ascending: false }),
      db.from("pl_queue").select("id,campaign_id,name,phone,send_at,status,error,sent_at,replied,texts").limit(10000),
    ]);
    if (error) throw error; if (qe) throw qe;
    return { campaigns: cs as Campaign[], queue: qs as QueueRow[] };
  } });
  const byCamp = useMemo(() => { const m = new Map<string, QueueRow[]>(); for (const r of data?.queue ?? []) m.set(r.campaign_id, [...(m.get(r.campaign_id) ?? []), r]); return m; }, [data]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["pl_campaigns"] });
  const q = data?.queue ?? [];
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["Enviadas", q.filter((r) => r.status === "enviada").length], ["Responderam", q.filter((r) => r.replied).length], ["Na fila", q.filter((r) => r.status === "pendente").length], ["Falhas", q.filter((r) => r.status === "falhou").length]].map(([t, v]) => (
          <div key={t} className="rounded-lg border bg-card p-3"><p className="text-xs text-muted-foreground">{t}</p><p className="text-2xl font-bold">{v}</p></div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Criar campanha</Button>
        <Button variant="outline" size="sm" onClick={refresh} disabled={isFetching}><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Atualizar</Button>
        {dataUpdatedAt > 0 && <span className="text-xs text-muted-foreground">Atualizado: {fmtWhen(new Date(dataUpdatedAt))}</span>}
      </div>
      {creating && <NewCampaign instances={instances} onClose={() => setCreating(false)} onDone={() => { setCreating(false); refresh(); }} />}
      {(data?.campaigns ?? []).length === 0 && !creating && <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma campanha ainda. Crie uma lista e um bloco de mensagens, depois publique sua primeira campanha.</p>}
      {(data?.campaigns ?? []).map((c) => <CampaignRow key={c.id} c={c} rows={byCamp.get(c.id) ?? []} instances={instances} onChanged={refresh} />)}
      <p className="text-xs text-muted-foreground">O robô confere a fila a cada 18 minutos na versão publicada, mesmo com o app fechado. Os dados desta tela só mudam quando você toca em Atualizar.</p>
    </div>
  );
}

export function usePlInstances() {
  const list = useServerFn(waList);
  const { data = [] } = useQuery({ queryKey: ["wa_instances"], queryFn: () => list(), retry: 1 });
  return data as { name: string; label: string; status: string }[];
}
