import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Building2, Copy, ExternalLink, Flame, Loader2, Search, Star, Trash2, UserPlus, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adToLead, listSavedAds, saveAd, searchAds, updateSavedAd, type SpyAd } from "@/lib/adspy.functions";

export const Route = createFileRoute("/_authenticated/spy")({
  head: () => ({
    meta: [
      { title: "BatRadar Spy — Minerador de anúncios" },
      { name: "description", content: "Minere anúncios da Biblioteca da Meta por nicho, país e status, salve e espione ofertas escaladas." },
      { property: "og:title", content: "BatRadar Spy — Minerador de anúncios" },
      { property: "og:description", content: "Espione anúncios ativos, encontre empresas que anunciam e modele ofertas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SpyPage,
});

type Mode = "empresas" | "ofertas";
const COUNTRIES = [["BR", "Brasil"], ["US", "EUA"], ["PT", "Portugal"], ["ES", "Espanha"], ["MX", "México"], ["AR", "Argentina"], ["GB", "Reino Unido"], ["ALL", "Todos"]];
const CACHE = "spy-cache-v1";

function SpyPage() {
  const qc = useQueryClient();
  const searchFn = useServerFn(searchAds);
  const saveFn = useServerFn(saveAd);
  const leadFn = useServerFn(adToLead);
  const listFn = useServerFn(listSavedAds);
  const updFn = useServerFn(updateSavedAd);
  const [mode, setMode] = useState<Mode>("empresas");
  const [tab, setTab] = useState<"busca" | "salvos">("busca");
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("BR");
  const [active, setActive] = useState<"active" | "all" | "inactive">("active");
  const [media, setMedia] = useState<"all" | "image" | "video">("all");
  const [limit, setLimit] = useState(30);
  const [minDays, setMinDays] = useState(0);
  const [sort, setSort] = useState<"dias" | "recentes">("dias");
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [ads, setAds] = useState<SpyAd[]>([]);
  const [last, setLast] = useState<{ q: string; at: string } | null>(null);
  const saved = useQuery({ queryKey: ["spy-saved"], queryFn: () => listFn() });
  const savedIds = useMemo(() => new Set((saved.data ?? []).map((s: any) => s.ad_id)), [saved.data]);

  useEffect(() => {
    try { const c = JSON.parse(localStorage.getItem(CACHE) || "{}")[mode]; if (c) { setAds(c.ads); setLast({ q: c.q, at: c.at }); setQ(c.q); } else { setAds([]); setLast(null); } } catch { /* sem cache */ }
  }, [mode]);

  async function run(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const r = await searchFn({ data: { q, country, active, media, limit } });
      setAds(r.ads); setLast({ q, at: r.searchedAt });
      const all = JSON.parse(localStorage.getItem(CACHE) || "{}"); all[mode] = { ads: r.ads, q, at: r.searchedAt };
      localStorage.setItem(CACHE, JSON.stringify(all));
      toast.success(`${r.ads.length} anúncios encontrados`);
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  }

  const shown = useMemo(() => {
    const f = filter.toLowerCase();
    return ads.filter((a) => (a.days_running ?? 0) >= minDays && (!f || `${a.page_name} ${a.body} ${a.title}`.toLowerCase().includes(f)))
      .sort((a, b) => sort === "dias" ? (b.days_running ?? 0) - (a.days_running ?? 0) : (b.start_date ?? "").localeCompare(a.start_date ?? ""));
  }, [ads, minDays, filter, sort]);

  async function doSave(a: SpyAd) {
    try { await saveFn({ data: { mode, country, keyword: last?.q ?? q, ad: a } }); toast.success("Salvo no cofre"); qc.invalidateQueries({ queryKey: ["spy-saved"] }); } catch (e: any) { toast.error(e.message); }
  }
  async function doLead(a: SpyAd) {
    try { await leadFn({ data: { ad: a, keyword: last?.q ?? q } }); toast.success("Enviado para Leads externos"); } catch (e: any) { toast.error(e.message); }
  }

  const savedList = (saved.data ?? []).filter((s: any) => s.mode === mode);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">BatRadar Spy</h1>
            <p className="text-sm text-muted-foreground">Biblioteca de anúncios da Meta · cada busca gasta saldo da Apify, resultados ficam guardados aqui.</p>
          </div>
          <div className="flex rounded-lg border p-1">
            <Button size="sm" variant={mode === "empresas" ? "default" : "ghost"} onClick={() => setMode("empresas")}><Building2 className="h-4 w-4" />Empresas</Button>
            <Button size="sm" variant={mode === "ofertas" ? "default" : "ghost"} onClick={() => setMode("ofertas")}><Sparkles className="h-4 w-4" />Ofertas</Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant={tab === "busca" ? "secondary" : "ghost"} onClick={() => setTab("busca")}><Search className="h-4 w-4" />Minerar</Button>
          <Button size="sm" variant={tab === "salvos" ? "secondary" : "ghost"} onClick={() => setTab("salvos")}><Star className="h-4 w-4" />Cofre ({savedList.length})</Button>
        </div>

        {tab === "busca" ? (<>
          <form onSubmit={run} className="grid gap-2 rounded-xl border bg-card p-3 md:grid-cols-6">
            <Input className="md:col-span-2" required minLength={2} placeholder={mode === "empresas" ? "Nicho: psicólogo, clínica, estética…" : "Palavra-chave: método, curso, desafio…"} value={q} onChange={(e) => setQ(e.target.value)} />
            <Select value={country} onValueChange={setCountry}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{COUNTRIES.map(([v, l]) => <SelectItem key={v} value={v!}>{l}</SelectItem>)}</SelectContent></Select>
            <Select value={active} onValueChange={(v) => setActive(v as any)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Só ativos</SelectItem><SelectItem value="all">Ativos e inativos</SelectItem><SelectItem value="inactive">Só inativos</SelectItem></SelectContent></Select>
            <Select value={media} onValueChange={(v) => setMedia(v as any)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toda mídia</SelectItem><SelectItem value="image">Imagem</SelectItem><SelectItem value="video">Vídeo</SelectItem></SelectContent></Select>
            <div className="flex gap-2">
              <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[20, 30, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n} anúncios</SelectItem>)}</SelectContent></Select>
              <Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button>
            </div>
          </form>
          {busy && <p className="text-sm text-muted-foreground">Minerando na Biblioteca da Meta… pode levar até 2 minutos.</p>}
          {ads.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">{last && `“${last.q}” · ${new Date(last.at).toLocaleString("pt-BR")} · `}{shown.length} de {ads.length}</span>
              <Input className="h-8 w-48" placeholder="Filtrar resultados" value={filter} onChange={(e) => setFilter(e.target.value)} />
              <Select value={String(minDays)} onValueChange={(v) => setMinDays(Number(v))}><SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger><SelectContent>{[0, 7, 15, 30, 60, 90].map((n) => <SelectItem key={n} value={String(n)}>{n ? `${n}+ dias no ar` : "Qualquer tempo"}</SelectItem>)}</SelectContent></Select>
              <Select value={sort} onValueChange={(v) => setSort(v as any)}><SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="dias">Mais tempo no ar</SelectItem><SelectItem value="recentes">Mais recentes</SelectItem></SelectContent></Select>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((a) => <AdCard key={a.ad_id} a={a} mode={mode} saved={savedIds.has(a.ad_id)} onSave={() => doSave(a)} onLead={() => doLead(a)} />)}
          </div>
          {!busy && ads.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Faça uma busca para começar a espionar.</p>}
        </>) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {savedList.map((s: any) => (
              <AdCard key={s.id} mode={mode} saved a={{ ...s, platforms: s.platforms ?? [], page_pic: null, end_date: null, days_running: s.start_date ? Math.round((Date.now() - new Date(s.start_date).getTime()) / 86400000) : null, library_url: `https://www.facebook.com/ads/library/?id=${s.ad_id}` }}
                onLead={() => doLead(s)}
                extra={<SavedTools s={s} onChange={() => qc.invalidateQueries({ queryKey: ["spy-saved"] })} upd={updFn} />} />
            ))}
            {savedList.length === 0 && <p className="col-span-full py-10 text-center text-sm text-muted-foreground">Nada salvo neste modo ainda.</p>}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function SavedTools({ s, onChange, upd }: { s: any; onChange: () => void; upd: any }) {
  const [notes, setNotes] = useState(s.notes ?? "");
  return (
    <div className="space-y-2 border-t pt-2">
      <Textarea rows={2} placeholder="Anotações (gancho, ideia de modelagem…)" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={async () => { if (notes !== (s.notes ?? "")) { await upd({ data: { id: s.id, notes } }); toast.success("Anotação salva"); onChange(); } }} />
      <Button size="sm" variant="ghost" onClick={async () => { await upd({ data: { id: s.id, remove: true } }); onChange(); }}><Trash2 className="h-4 w-4" />Remover</Button>
    </div>
  );
}

function AdCard({ a, mode, saved, onSave, onLead, extra }: { a: SpyAd; mode: Mode; saved?: boolean; onSave?: () => void; onLead?: () => void; extra?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const hot = (a.days_running ?? 0) >= 30 && a.is_active !== false;
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2">
        {a.page_pic ? <img src={a.page_pic} alt="" className="h-8 w-8 rounded-full" /> : <div className="h-8 w-8 rounded-full bg-muted" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{a.page_name ?? "Anunciante"}</p>
          <p className="text-xs text-muted-foreground">{a.start_date ? `Desde ${new Date(a.start_date).toLocaleDateString("pt-BR")}` : "Data desconhecida"} · {a.days_running ?? "?"} dias {a.is_active === false ? "· inativo" : "· ativo"}</p>
        </div>
        {hot && <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary"><Flame className="h-3 w-3" />Escalando</span>}
      </div>
      {a.video_url ? <video src={a.video_url} poster={a.image_url ?? undefined} controls preload="none" className="aspect-square w-full rounded-lg bg-muted object-cover" />
        : a.image_url ? <img src={a.image_url} alt="" loading="lazy" className="aspect-square w-full rounded-lg bg-muted object-cover" /> : null}
      {a.title && <p className="text-sm font-medium">{a.title}</p>}
      {a.body && <p className={`whitespace-pre-line text-sm text-muted-foreground ${open ? "" : "line-clamp-4"}`} onClick={() => setOpen(!open)}>{a.body}</p>}
      <p className="text-xs text-muted-foreground">{a.cta ? `Botão: ${a.cta} · ` : ""}{a.platforms.join(", ").toLowerCase()}</p>
      <div className="mt-auto flex flex-wrap gap-1">
        {a.body && <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(a.body!); toast.success("Copy copiada"); }}><Copy className="h-4 w-4" /></Button>}
        <Button size="sm" variant="outline" asChild><a href={a.library_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />Meta</a></Button>
        {a.link_url && <Button size="sm" variant="outline" asChild><a href={a.link_url} target="_blank" rel="noreferrer">Página</a></Button>}
        {onSave && <Button size="sm" variant={saved ? "secondary" : "outline"} disabled={saved} onClick={onSave}><Star className="h-4 w-4" />{saved ? "Salvo" : "Salvar"}</Button>}
        {mode === "empresas" && onLead && <Button size="sm" onClick={onLead}><UserPlus className="h-4 w-4" />Lead</Button>}
      </div>
      {extra}
    </div>
  );
}
