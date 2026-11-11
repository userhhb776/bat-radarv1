import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Building2, Copy, ExternalLink, Flame, Loader2, Search, Star, Trash2, UserPlus, Sparkles, SlidersHorizontal, Users, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adToLead, listSavedAds, saveAd, searchAds, updateSavedAd, type SpyAd } from "@/lib/adspy.functions";

export const Route = createFileRoute("/_authenticated/spy")({
  head: () => ({
    meta: [
      { title: "Bat Spy — Minerador de anúncios" },
      { name: "description", content: "Minere anúncios da Meta por nicho, país, tempo no ar e plataforma; salve e espione ofertas escaladas." },
      { property: "og:title", content: "Bat Spy — Minerador de anúncios" },
      { property: "og:description", content: "Espione anúncios escalados, anunciantes e modele ofertas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SpyPage,
});

type Mode = "empresas" | "ofertas";
type Tab = "busca" | "anunciantes" | "salvos";
const COUNTRIES = [["BR", "Brasil"], ["US", "EUA"], ["PT", "Portugal"], ["ES", "Espanha"], ["MX", "México"], ["AR", "Argentina"], ["CO", "Colômbia"], ["CL", "Chile"], ["PE", "Peru"], ["GB", "Reino Unido"], ["CA", "Canadá"], ["FR", "França"], ["DE", "Alemanha"], ["IT", "Itália"], ["AU", "Austrália"], ["ALL", "Todos"]];
const NICHES: Record<Mode, string[]> = {
  empresas: ["psicólogo", "clínica estética", "dentista", "advogado", "nutricionista", "academia", "imobiliária", "pet shop", "fisioterapia", "restaurante"],
  ofertas: ["emagrecimento", "renda extra", "curso online", "mentoria", "desafio 21 dias", "ebook", "relacionamento", "inglês", "marketing digital", "infoproduto"],
};
const DAYS = [[0, "Qualquer"], [7, "7+ dias"], [14, "14+ dias"], [30, "30+ dias"], [60, "60+ dias"], [90, "90+ dias"]] as const;
const PLATFORMS = [["all", "Todas"], ["facebook", "Facebook"], ["instagram", "Instagram"], ["messenger", "Messenger"], ["audience_network", "Audience"]];
const CACHE = "spy-cache-v1";

function domainOf(u: string | null) { try { return u ? new URL(u).hostname.replace(/^www\./, "") : ""; } catch { return ""; } }

function SpyPage() {
  const qc = useQueryClient();
  const searchFn = useServerFn(searchAds);
  const saveFn = useServerFn(saveAd);
  const leadFn = useServerFn(adToLead);
  const listFn = useServerFn(listSavedAds);
  const updFn = useServerFn(updateSavedAd);
  const [mode, setMode] = useState<Mode>("ofertas");
  const [tab, setTab] = useState<Tab>("busca");
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("BR");
  const [active, setActive] = useState<"active" | "all" | "inactive">("active");
  const [media, setMedia] = useState<"all" | "image" | "video">("all");
  const [limit, setLimit] = useState(30);
  // filtros locais (não gastam saldo)
  const [minDays, setMinDays] = useState(0);
  const [maxDays, setMaxDays] = useState(0);
  const [platform, setPlatform] = useState("all");
  const [kind, setKind] = useState<"all" | "video" | "image">("all");
  const [withLink, setWithLink] = useState(false);
  const [cta, setCta] = useState("all");
  const [page, setPage] = useState("");
  const [sort, setSort] = useState<"dias" | "recentes" | "anunciante">("dias");
  const [filter, setFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [vaultQ, setVaultQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [ads, setAds] = useState<SpyAd[]>([]);
  const [last, setLast] = useState<{ q: string; at: string } | null>(null);
  const saved = useQuery({ queryKey: ["spy-saved"], queryFn: () => listFn() });
  const savedIds = useMemo(() => new Set((saved.data ?? []).map((s: any) => s.ad_id)), [saved.data]);

  useEffect(() => {
    try { const c = JSON.parse(localStorage.getItem(CACHE) || "{}")[mode]; if (c) { setAds(c.ads); setLast({ q: c.q, at: c.at }); setQ(c.q); } else { setAds([]); setLast(null); } } catch { /* sem cache */ }
  }, [mode]);

  async function run(e?: React.FormEvent, term?: string) {
    e?.preventDefault();
    const query = (term ?? q).trim(); if (query.length < 2) return toast.error("Digite ao menos 2 letras");
    setQ(query); setBusy(true); setTab("busca");
    try {
      const r = await searchFn({ data: { q: query, country, active, media, limit } });
      setAds(r.ads); setLast({ q: query, at: r.searchedAt });
      const all = JSON.parse(localStorage.getItem(CACHE) || "{}"); all[mode] = { ads: r.ads, q: query, at: r.searchedAt };
      localStorage.setItem(CACHE, JSON.stringify(all));
      toast.success(`${r.ads.length} anúncios encontrados`);
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  }

  const pageCount = useMemo(() => { const m = new Map<string, number>(); ads.forEach((a) => { const k = a.page_name ?? "?"; m.set(k, (m.get(k) ?? 0) + 1); }); return m; }, [ads]);
  const ctas = useMemo(() => Array.from(new Set(ads.map((a) => a.cta).filter(Boolean) as string[])).sort(), [ads]);

  const shown = useMemo(() => {
    const f = filter.toLowerCase();
    return ads.filter((a) => {
      const d = a.days_running ?? 0;
      if (d < minDays) return false;
      if (maxDays && d > maxDays) return false;
      if (platform !== "all" && !a.platforms.some((p) => p.toLowerCase() === platform)) return false;
      if (kind === "video" && !a.video_url) return false;
      if (kind === "image" && (a.video_url || !a.image_url)) return false;
      if (withLink && !a.link_url) return false;
      if (cta !== "all" && a.cta !== cta) return false;
      if (page && a.page_name !== page) return false;
      return !f || `${a.page_name} ${a.body} ${a.title} ${a.link_url}`.toLowerCase().includes(f);
    }).sort((a, b) => sort === "dias" ? (b.days_running ?? 0) - (a.days_running ?? 0)
      : sort === "anunciante" ? (pageCount.get(b.page_name ?? "?") ?? 0) - (pageCount.get(a.page_name ?? "?") ?? 0)
      : (b.start_date ?? "").localeCompare(a.start_date ?? ""));
  }, [ads, minDays, maxDays, platform, kind, withLink, cta, page, filter, sort, pageCount]);

  const advertisers = useMemo(() => {
    const m = new Map<string, { name: string; pic: string | null; count: number; maxDays: number; active: number; domain: string }>();
    ads.forEach((a) => {
      const k = a.page_name ?? "Anunciante"; const cur = m.get(k) ?? { name: k, pic: a.page_pic, count: 0, maxDays: 0, active: 0, domain: domainOf(a.link_url) };
      cur.count++; cur.maxDays = Math.max(cur.maxDays, a.days_running ?? 0); if (a.is_active !== false) cur.active++; if (!cur.domain) cur.domain = domainOf(a.link_url);
      m.set(k, cur);
    });
    return [...m.values()].sort((a, b) => b.count - a.count || b.maxDays - a.maxDays);
  }, [ads]);

  const activeFilters = [minDays > 0, maxDays > 0, platform !== "all", kind !== "all", withLink, cta !== "all", !!page, !!filter].filter(Boolean).length;
  function clearFilters() { setMinDays(0); setMaxDays(0); setPlatform("all"); setKind("all"); setWithLink(false); setCta("all"); setPage(""); setFilter(""); }

  async function doSave(a: SpyAd) {
    try { await saveFn({ data: { mode, country, keyword: last?.q ?? q, ad: a } }); toast.success("Salvo no cofre"); qc.invalidateQueries({ queryKey: ["spy-saved"] }); } catch (e: any) { toast.error(e.message); }
  }
  async function doLead(a: SpyAd) {
    try { await leadFn({ data: { ad: a, keyword: last?.q ?? q } }); toast.success("Enviado para Leads externos"); } catch (e: any) { toast.error(e.message); }
  }

  const savedList = (saved.data ?? []).filter((s: any) => s.mode === mode && (!vaultQ || `${s.page_name} ${s.body} ${s.keyword} ${s.notes}`.toLowerCase().includes(vaultQ.toLowerCase())));

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl space-y-4 overflow-x-hidden p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">Bat Spy</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">Biblioteca de anúncios da Meta · cada busca gasta saldo da Apify; filtros abaixo da busca são grátis.</p>
          </div>
          <div className="grid grid-cols-2 rounded-lg border p-1">
            <Button size="sm" variant={mode === "empresas" ? "default" : "ghost"} onClick={() => setMode("empresas")}><Building2 className="h-4 w-4" />Empresas</Button>
            <Button size="sm" variant={mode === "ofertas" ? "default" : "ghost"} onClick={() => setMode("ofertas")}><Sparkles className="h-4 w-4" />Ofertas</Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-lg border p-1 sm:inline-grid sm:w-auto">
          <Button size="sm" variant={tab === "busca" ? "secondary" : "ghost"} onClick={() => setTab("busca")}><Search className="h-4 w-4" />Minerar</Button>
          <Button size="sm" variant={tab === "anunciantes" ? "secondary" : "ghost"} onClick={() => setTab("anunciantes")}><Users className="h-4 w-4" />Anunciantes</Button>
          <Button size="sm" variant={tab === "salvos" ? "secondary" : "ghost"} onClick={() => setTab("salvos")}><Star className="h-4 w-4" />Cofre</Button>
        </div>

        {tab !== "salvos" && (
          <form onSubmit={run} className="space-y-2 rounded-xl border bg-card p-3">
            <div className="flex gap-2">
              <Input className="min-w-0 flex-1" placeholder={mode === "empresas" ? "Nicho: psicólogo, clínica, estética…" : "Palavra-chave: método, curso, desafio…"} value={q} onChange={(e) => setQ(e.target.value)} />
              <Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}<span className="hidden sm:inline">Minerar</span></Button>
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {NICHES[mode].map((n) => <button type="button" key={n} disabled={busy} onClick={() => run(undefined, n)} className="shrink-0 rounded-full border px-3 py-1 text-xs hover:bg-muted">{n}</button>)}
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Select value={country} onValueChange={setCountry}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{COUNTRIES.map(([v, l]) => <SelectItem key={v} value={v!}>{l}</SelectItem>)}</SelectContent></Select>
              <Select value={active} onValueChange={(v) => setActive(v as any)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Só ativos</SelectItem><SelectItem value="all">Ativos e inativos</SelectItem><SelectItem value="inactive">Só inativos</SelectItem></SelectContent></Select>
              <Select value={media} onValueChange={(v) => setMedia(v as any)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toda mídia</SelectItem><SelectItem value="image">Imagem</SelectItem><SelectItem value="video">Vídeo</SelectItem></SelectContent></Select>
              <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[20, 30, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n} anúncios</SelectItem>)}</SelectContent></Select>
            </div>
          </form>
        )}
        {busy && <p className="text-sm text-muted-foreground">Minerando na Biblioteca da Meta… pode levar até 2 minutos.</p>}

        {tab === "busca" && (<>
          {ads.length > 0 && (
            <div className="space-y-2 rounded-xl border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{last && `“${last.q}” · `}{shown.length} de {ads.length}</span>
                <Select value={sort} onValueChange={(v) => setSort(v as any)}><SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="dias">Mais escalados</SelectItem><SelectItem value="recentes">Mais recentes</SelectItem><SelectItem value="anunciante">Anunciante com mais anúncios</SelectItem></SelectContent></Select>
                <Button size="sm" variant="outline" onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal className="h-4 w-4" />Filtros{activeFilters ? ` (${activeFilters})` : ""}</Button>
              </div>
              <div className="flex gap-1 overflow-x-auto pb-1">
                {DAYS.map(([n, l]) => <button key={n} onClick={() => setMinDays(n)} className={`shrink-0 rounded-full border px-3 py-1 text-xs ${minDays === n ? "border-primary bg-primary/15 text-primary" : ""}`}>{n >= 30 && <Flame className="mr-1 inline h-3 w-3" />}{l}</button>)}
              </div>
              {showFilters && (
                <div className="grid grid-cols-2 gap-2 border-t pt-2 md:grid-cols-4">
                  <Input className="col-span-2 h-9" placeholder="Palavra no texto, página ou domínio" value={filter} onChange={(e) => setFilter(e.target.value)} />
                  <Select value={String(maxDays)} onValueChange={(v) => setMaxDays(Number(v))}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">Sem máximo</SelectItem>{[3, 7, 14, 30, 60].map((n) => <SelectItem key={n} value={String(n)}>Até {n} dias (novos)</SelectItem>)}</SelectContent></Select>
                  <Select value={platform} onValueChange={setPlatform}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{PLATFORMS.map(([v, l]) => <SelectItem key={v} value={v!}>{l}</SelectItem>)}</SelectContent></Select>
                  <Select value={kind} onValueChange={(v) => setKind(v as any)}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Vídeo e imagem</SelectItem><SelectItem value="video">Só vídeo</SelectItem><SelectItem value="image">Só imagem</SelectItem></SelectContent></Select>
                  <Select value={cta} onValueChange={setCta}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Qualquer botão</SelectItem>{ctas.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={withLink} onChange={(e) => setWithLink(e.target.checked)} />Só com página de destino</label>
                  {page && <Button size="sm" variant="secondary" className="justify-start truncate" onClick={() => setPage("")}><X className="h-4 w-4" />{page}</Button>}
                  <Button size="sm" variant="ghost" onClick={clearFilters}>Limpar filtros</Button>
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((a) => <AdCard key={a.ad_id} a={a} mode={mode} count={pageCount.get(a.page_name ?? "?")} saved={savedIds.has(a.ad_id)} onSave={() => doSave(a)} onLead={() => doLead(a)} onPage={() => { setPage(a.page_name ?? ""); setShowFilters(true); }} />)}
          </div>
          {!busy && ads.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Escolha um nicho acima ou digite uma palavra para começar a espionar.</p>}
          {ads.length > 0 && shown.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum anúncio com esses filtros.</p>}
        </>)}

        {tab === "anunciantes" && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {advertisers.map((p) => (
              <button key={p.name} onClick={() => { setPage(p.name); setShowFilters(true); setTab("busca"); }} className="flex items-center gap-3 rounded-xl border bg-card p-3 text-left hover:bg-muted">
                {p.pic ? <img src={p.pic} alt="" className="h-10 w-10 shrink-0 rounded-full" /> : <div className="h-10 w-10 shrink-0 rounded-full bg-muted" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.count} anúncios · {p.active} ativos · até {p.maxDays} dias{p.domain ? ` · ${p.domain}` : ""}</p>
                </div>
                {p.count >= 3 && <Flame className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            ))}
            {advertisers.length === 0 && <p className="col-span-full py-10 text-center text-sm text-muted-foreground">Faça uma busca para ver quem mais anuncia no nicho.</p>}
          </div>
        )}

        {tab === "salvos" && (<>
          <Input placeholder="Buscar no cofre (página, texto, nicho, anotação)" value={vaultQ} onChange={(e) => setVaultQ(e.target.value)} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {savedList.map((s: any) => (
              <AdCard key={s.id} mode={mode} saved a={{ ...s, platforms: s.platforms ?? [], page_pic: null, end_date: null, days_running: s.start_date ? Math.round((Date.now() - new Date(s.start_date).getTime()) / 86400000) : null, library_url: `https://www.facebook.com/ads/library/?id=${s.ad_id}` }}
                onLead={() => doLead(s)}
                extra={<SavedTools s={s} onChange={() => qc.invalidateQueries({ queryKey: ["spy-saved"] })} upd={updFn} />} />
            ))}
            {savedList.length === 0 && <p className="col-span-full py-10 text-center text-sm text-muted-foreground">Nada salvo neste modo ainda.</p>}
          </div>
        </>)}
      </div>
    </AppShell>
  );
}

function SavedTools({ s, onChange, upd }: { s: any; onChange: () => void; upd: any }) {
  const [notes, setNotes] = useState(s.notes ?? "");
  return (
    <div className="space-y-2 border-t pt-2">
      {s.keyword && <p className="text-xs text-muted-foreground">Nicho: {s.keyword} · {s.country}</p>}
      <Textarea rows={2} placeholder="Anotações (gancho, ideia de modelagem…)" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={async () => { if (notes !== (s.notes ?? "")) { await upd({ data: { id: s.id, notes } }); toast.success("Anotação salva"); onChange(); } }} />
      <Button size="sm" variant="ghost" onClick={async () => { await upd({ data: { id: s.id, remove: true } }); onChange(); }}><Trash2 className="h-4 w-4" />Remover</Button>
    </div>
  );
}

function AdCard({ a, mode, saved, count, onSave, onLead, onPage, extra }: { a: SpyAd; mode: Mode; saved?: boolean; count?: number; onSave?: () => void; onLead?: () => void; onPage?: () => void; extra?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const d = a.days_running ?? 0;
  const hot = d >= 30 && a.is_active !== false;
  const dom = domainOf(a.link_url);
  return (
    <div className="flex min-w-0 flex-col gap-2 overflow-hidden rounded-xl border bg-card p-3">
      <div className="flex min-w-0 items-center gap-2">
        {a.page_pic ? <img src={a.page_pic} alt="" className="h-8 w-8 shrink-0 rounded-full" /> : <div className="h-8 w-8 shrink-0 rounded-full bg-muted" />}
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onPage} className="block max-w-full truncate text-left text-sm font-semibold hover:underline">{a.page_name ?? "Anunciante"}</button>
          <p className="truncate text-xs text-muted-foreground">{a.start_date ? `Desde ${new Date(a.start_date).toLocaleDateString("pt-BR")}` : "Data ?"}{a.is_active === false ? " · inativo" : " · ativo"}{count && count > 1 ? ` · ${count} anúncios` : ""}</p>
        </div>
        <span className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${hot ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{hot && <Flame className="h-3 w-3" />}{a.days_running ?? "?"}d</span>
      </div>
      {a.video_url ? <video src={a.video_url} poster={a.image_url ?? undefined} controls preload="none" playsInline className="aspect-square w-full max-w-full rounded-lg bg-muted object-contain" />
        : a.image_url ? <img src={a.image_url} alt="" loading="lazy" className="aspect-square w-full max-w-full rounded-lg bg-muted object-contain" /> : null}
      {a.title && <p className="break-words text-sm font-medium">{a.title}</p>}
      {a.body && <p className={`cursor-pointer whitespace-pre-line break-words text-sm text-muted-foreground ${open ? "" : "line-clamp-4"}`} onClick={() => setOpen(!open)}>{a.body}</p>}
      <p className="break-words text-xs text-muted-foreground">{a.cta ? `Botão: ${a.cta} · ` : ""}{dom ? `${dom} · ` : ""}{a.platforms.join(", ").toLowerCase()}</p>
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
