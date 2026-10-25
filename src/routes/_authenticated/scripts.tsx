import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Pencil, Plus, Send, Shuffle, Trash2, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { waList, waTest } from "@/lib/whatsapp.functions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SCRIPT_STAGES, SITE_FILTERS, VARIABLES, deleteScript, distributeVariants, fillScript, listScripts, saveScript, scriptMessages, scriptSlots, scriptsKey, type Script } from "@/lib/scripts";

export const Route = createFileRoute("/_authenticated/scripts")({
  head: () => ({ meta: [
    { title: "Scripts de abordagem — BatRadar 5.7" }, { name: "description", content: "Modelos prontos de mensagens por nicho e etapa da venda." },
    { property: "og:title", content: "Scripts de abordagem — BatRadar 5.7" }, { property: "og:description", content: "Crie e reutilize abordagens prontas." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: ScriptsPage,
});

type Draft = { id?: string; title: string; niche: string; stage: string; site_filter: string; body: string; message2: string; message3: string; variants: string[][] };
const empty: Draft = { title: "", niche: "", stage: "primeiro_contato", site_filter: "todos", body: "", message2: "", message3: "", variants: [[], [], []] };
const sample = { name: "Clínica Sorriso", city: "Campinas", niche: "Dentista", rating: 4.7, reviews: 85, website: null };

function ScriptsPage() {
  const qc = useQueryClient();
  const { data: scripts = [], isLoading } = useQuery({ queryKey: scriptsKey, queryFn: listScripts });
  const [d, setD] = useState<Draft>(empty);
  const vars = (i: number) => d.variants?.[i] ?? [];
  const setVars = (i: number, v: string[]) => setD({ ...d, variants: [0, 1, 2].map((k) => (k === i ? v : vars(k))) });
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const listFn = useServerFn(waList); const testFn = useServerFn(waTest);
  const { data: instances = [] } = useQuery({ queryKey: ["wa_instances"], queryFn: () => listFn(), retry: 1 });
  const [testPhone, setTestPhone] = useState("5568992316302");
  const [testing, setTesting] = useState<string | null>(null);
  async function test(s: Script) {
    const inst = instances.find((i) => i.status === "open");
    if (!inst) { toast.error("Nenhum número conectado na aba WhatsApp."); return; }
    setTesting(s.id);
    try {
      const r = await testFn({ data: { name: inst.name, phone: testPhone, texts: distributeVariants(s, 1)[0]!.map((m) => fillScript(m, sample)), gapS: 10 } });
      toast.success(`${r.sent} mensagem(ns) de teste enviada(s) em ordem`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha no teste"); } finally { setTesting(null); }
  }

  async function submit() {
    if (!d.title.trim() || !d.body.trim()) { toast.error("Preencha título e mensagem"); return; }
    setBusy(true);
    try {
      await saveScript({ ...d, title: d.title.trim().slice(0, 120), body: d.body.slice(0, 2000), message2: d.message2.slice(0, 2000), message3: d.message3.slice(0, 2000), niche: d.niche.trim().slice(0, 80) });
      await qc.invalidateQueries({ queryKey: scriptsKey });
      toast.success(d.id ? "Script atualizado" : "Script salvo");
      setD(empty);
    } catch { toast.error("Não foi possível salvar"); } finally { setBusy(false); }
  }
  async function remove(s: Script) {
    if (!confirm(`Excluir "${s.title}"?`)) return;
    await deleteScript(s.id);
    qc.invalidateQueries({ queryKey: scriptsKey });
  }
  const shown = scripts.filter((s) => !filter || (s.niche || "").toLowerCase().includes(filter.toLowerCase()) || s.title.toLowerCase().includes(filter.toLowerCase()));

  return <AppShell>
    <p className="text-xs font-semibold uppercase text-primary">Abordagens</p>
    <h1 className="text-3xl font-bold">Scripts</h1>
    <p className="mt-1 text-sm text-muted-foreground">Monte funis de até 3 mensagens. Eles são usados nas Campanhas e no pipeline.</p>

    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="min-w-0 space-y-3 rounded-md border bg-card p-4 sm:p-5">
        <h2 className="font-semibold">{d.id ? "Editar script" : "Novo script"}</h2>
        <div><Label htmlFor="t">Título</Label><Input id="t" value={d.title} maxLength={120} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Ex.: Restaurante sem site — 1º contato" /></div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label htmlFor="n">Nicho</Label><Input id="n" value={d.niche} maxLength={80} onChange={(e) => setD({ ...d, niche: e.target.value })} placeholder="Todos" /></div>
          <div><Label>Etapa</Label>
            <Select value={d.stage} onValueChange={(v) => setD({ ...d, stage: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SCRIPT_STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Para</Label>
            <Select value={d.site_filter} onValueChange={(v) => setD({ ...d, site_filter: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SITE_FILTERS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent></Select></div>
        </div>
        {(["body", "message2", "message3"] as const).map((k, i) => (
          <div key={k} className="rounded-md border p-3">
            <Label htmlFor={k}>Mensagem {i + 1}{i > 0 ? " (opcional)" : ""}</Label>
            <Textarea id={k} rows={i ? 4 : 6} maxLength={2000} value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} placeholder={i === 0 ? "Oi, tudo bem? Falo com o responsável pela {nome}?" : i === 1 ? "Vi que vocês ainda não têm site próprio..." : "Posso te mandar um exemplo?"} />
            <div className="mt-2 flex flex-wrap gap-1">
              {VARIABLES.map((v) => <Button key={v} type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setD({ ...d, [k]: d[k] + v })}>{v}</Button>)}
            </div>
            {d[k] && <div className="mt-2 rounded-md bg-muted p-3 text-sm"><p className="mb-1 text-xs font-semibold text-muted-foreground">Prévia</p><p className="whitespace-pre-wrap break-words">{fillScript(d[k], sample)}</p></div>}
            {vars(i).map((v, n) => (
              <div key={n} className="mt-2 flex gap-2">
                <Textarea rows={2} maxLength={2000} value={v} onChange={(e) => setVars(i, vars(i).map((x, m) => (m === n ? e.target.value : x)))} placeholder={`Variação ${n + 2} — mesma ideia com outras palavras`} />
                <Button size="icon" variant="ghost" aria-label="Remover variação" onClick={() => setVars(i, vars(i).filter((_, m) => m !== n))}><X className="h-4 w-4" /></Button>
              </div>
            ))}
            {(d[k].trim() || vars(i).length > 0) && <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => setVars(i, [...vars(i), ""])}><Shuffle className="h-4 w-4" /> Adicionar variação</Button>}
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Nas campanhas, as variações de cada mensagem são distribuídas de forma equilibrada entre as empresas, para os textos não saírem iguais.</p>
        <div className="flex gap-2">
          <Button onClick={submit} disabled={busy}><Plus className="h-4 w-4" />{d.id ? "Salvar alterações" : "Salvar script"}</Button>
          {d.id && <Button variant="ghost" onClick={() => setD(empty)}>Cancelar</Button>}
        </div>
      </section>

      <section className="min-w-0 space-y-3">
        <div className="flex items-center gap-2 text-sm"><Label htmlFor="tp" className="shrink-0">Meu nº de teste</Label><Input id="tp" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} /></div>
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar por nicho ou título" />
        {isLoading && <p className="text-muted-foreground">Carregando...</p>}
        {!isLoading && shown.length === 0 && <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum script ainda.</p>}
        {shown.map((s) => (
          <article key={s.id} className="min-w-0 rounded-md border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><h3 className="break-words font-semibold">{s.title}</h3>
                <p className="text-xs text-muted-foreground">{s.niche || "Todos os nichos"} · {SCRIPT_STAGES.find((x) => x.id === s.stage)?.label} · {SITE_FILTERS.find((x) => x.id === s.site_filter)?.label}</p></div>
              <div className="flex shrink-0">
                <Button size="sm" variant="outline" disabled={testing !== null} onClick={() => test(s)}><Send className="h-4 w-4" />{testing === s.id ? "Enviando..." : "Teste"}</Button>
                <Button size="icon" variant="ghost" aria-label="Copiar" onClick={() => { navigator.clipboard.writeText(scriptMessages(s).join("\n\n")); toast.success("Copiado"); }}><Copy className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setD({ id: s.id, title: s.title, niche: s.niche, stage: s.stage, site_filter: s.site_filter, body: s.body, message2: s.message2 ?? "", message3: s.message3 ?? "", variants: s.variants ?? [[], [], []] })}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" aria-label="Excluir" className="hover:text-destructive" onClick={() => remove(s)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="mt-2 grid gap-1">{scriptSlots(s).map((opts, i) => <p key={i} className="line-clamp-3 whitespace-pre-wrap break-words rounded bg-muted/50 p-2 text-sm text-muted-foreground"><b className="text-foreground">{i + 1}.</b> {opts[0]}{opts.length > 1 && <span className="ml-1 text-xs text-primary">+{opts.length - 1} variação(ões)</span>}</p>)}</div>
          </article>
        ))}
      </section>
    </div>
  </AppShell>;
}
