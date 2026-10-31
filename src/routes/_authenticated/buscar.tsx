import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Loader2, RotateCcw, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LeadCard } from "@/components/LeadCard";
import { SaveToBlock } from "@/components/SaveToBlock";
import { LeadDialog } from "@/components/LeadDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { searchPlaces } from "@/lib/places.functions";
import { leadsKey, listLeads } from "@/lib/leads";
import { opportunityOf, type PlaceLead } from "@/lib/types";
import { NICHE_GROUPS, NICHES, isSocialLink } from "@/lib/niches";

function exportCsv(rows: PlaceLead[]) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["Empresa", "Telefone", "Endereço", "Nota", "Avaliações", "Status do site", "Site", "Oportunidade", "Google Maps"];
  const lines = rows.map((l) =>
    [l.name, l.intlPhone ?? l.phone, l.address, l.rating?.toFixed(1).replace(".", ","), l.reviews, l.website ? "Com site" : "Sem site", l.website, opportunityOf(l).label, l.mapsUrl]
      .map(esc)
      .join(";"),
  );
  const blob = new Blob(["\uFEFF" + [header.join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`${rows.length} empresas exportadas`);
}


export const Route = createFileRoute("/_authenticated/buscar")({
  head: () => ({
    meta: [
      { title: "Buscar empresas — BatRadar 5.7" },
      { name: "description", content: "Busque empresas locais por nicho, cidade e bairro." },
      { property: "og:title", content: "Buscar empresas — BatRadar 5.7" },
      { property: "og:description", content: "Filtros por site, nota e avaliações do Google Maps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BuscarPage,
});

function BuscarPage() {
  const search = useServerFn(searchPlaces);
  const { data: saved = [] } = useQuery({ queryKey: leadsKey, queryFn: listLeads });
  const [niche, setNiche] = useState("");
  const [store, setStore] = useState(false);
  const [city, setCity] = useState("");
  const [hood, setHood] = useState("");
  const [minRating, setMinRating] = useState("0");
  const [site, setSite] = useState<"todos" | "sem" | "com" | "social">("todos");
  const [minReviews, setMinReviews] = useState("");
  const [maxReviews, setMaxReviews] = useState("");
  const [opp, setOpp] = useState("todas");
  const [results, setResults] = useState<PlaceLead[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState<{ niche: string; city: string } | null>(null);
  const [open, setOpen] = useState<PlaceLead | null>(null);

  async function run(more = false) {
    if (niche.trim().length < 2 || (!store && city.trim().length < 2)) {
      toast.error(store ? "Informe o nome da loja." : "Informe nicho e cidade.");
      return;
    }
    setLoading(true);
    try {
      const r = await search({
        data: { niche, city, neighborhood: hood, store, minRating: Number(minRating), pageToken: more ? token ?? undefined : undefined },
      });
      const prevIds = new Set(more ? results.map((x) => x.placeId) : []);
      const fresh = r.leads.filter((l, i) => !prevIds.has(l.placeId) && r.leads.findIndex((x) => x.placeId === l.placeId) === i);
      setResults((prev) => (more ? [...prev, ...fresh] : fresh));
      setToken(r.nextPageToken);
      if (more) {
        const ok = fresh.filter(passes).length;
        if (fresh.length === 0) toast.info("Nenhuma empresa nova nesta página.");
        else toast.success(`${fresh.length} novas empresas carregadas · ${ok} compatíveis com os filtros`);
      }
      setSearched({ niche, city: [hood, city].filter(Boolean).join(", ") });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function reasons(l: PlaceLead) {
    const r: string[] = [];
    if (site === "sem" && l.website) r.push("site");
    if (site === "com" && !l.website) r.push("site");
    if (site === "social" && l.website && !isSocialLink(l.website)) r.push("site");
    if (minReviews !== "" && l.reviews < Number(minReviews)) r.push("min");
    if (maxReviews !== "" && l.reviews > Number(maxReviews)) r.push("max");
    if (opp !== "todas" && opportunityOf(l).level !== opp) r.push("opp");
    return r;
  }
  function passes(l: PlaceLead) {
    return reasons(l).length === 0;
  }

  const filtered = useMemo(() => results.filter(passes), [results, site, minReviews, maxReviews, opp]);

  const breakdown = useMemo(() => {
    const c = { site: 0, min: 0, max: 0, opp: 0 };
    for (const l of results) for (const k of reasons(l)) c[k as keyof typeof c]++;
    const labels: string[] = [];
    if (c.site) labels.push(`${c.site} por "${site === "sem" ? "Sem site" : site === "social" ? "Sem site ou só Instagram/WhatsApp" : "Com site"}"`);
    if (c.min) labels.push(`${c.min} com menos de ${minReviews} avaliações`);
    if (c.max) labels.push(`${c.max} com mais de ${maxReviews} avaliações`);
    if (c.opp) labels.push(`${c.opp} por nível de oportunidade`);
    return labels;
  }, [results, site, minReviews, maxReviews, opp]);

  const savedMap = useMemo(() => new Map(saved.map((s) => [s.place_id, s])), [saved]);
  const semSite = results.filter((r) => !r.website).length;
  const soSocial = results.filter((r) => isSocialLink(r.website)).length;
  const hasResultFilters = site !== "todos" || minReviews !== "" || maxReviews !== "" || opp !== "todas";

  function clearResultFilters() {
    setSite("todos");
    setMinReviews("");
    setMaxReviews("");
    setOpp("todas");
  }

  return (
    <AppShell>
      <h1 className="text-3xl font-bold">Buscar empresas</h1>
      <p className="mt-1 text-muted-foreground">Encontre negócios locais com oportunidade de site e Google Meu Negócio.</p>

      <form
        onSubmit={(e) => { e.preventDefault(); run(false); }}
        className="mt-6 rounded-lg border bg-card p-4 sm:p-5"
      >
        <div className="mb-4 inline-flex rounded-md border p-1">
          <Button type="button" size="sm" variant={store ? "ghost" : "secondary"} onClick={() => { setStore(false); setNiche(""); }}>Por nicho</Button>
          <Button type="button" size="sm" variant={store ? "secondary" : "ghost"} onClick={() => { setStore(true); setNiche(""); }}>Loja específica</Button>
        </div>
        {store ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Nome da loja</Label>
              <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Ex.: Padaria Pão Dourado" />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade ou país (opcional)</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex.: Lisboa, Portugal" />
            </div>
          </div>
        ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Nicho</Label>
            <div className="grid min-w-0 gap-2 sm:grid-cols-[11rem_minmax(0,1fr)]">
              <Select value={NICHES.includes(niche) ? niche : ""} onValueChange={setNiche}>
                <SelectTrigger className="min-w-0 w-full"><SelectValue placeholder={`${NICHES.length} nichos`} /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {Object.entries(NICHE_GROUPS).map(([g, items]) => (
                    <div key={g}>
                      <div className="px-2 py-1.5 text-xs font-semibold uppercase text-muted-foreground">{g}</div>
                      {items.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </div>
                  ))}
                </SelectContent>
              </Select>
              <Input className="min-w-0" list="niches" value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Ou digite um nicho" />
            </div>
            <datalist id="niches">{NICHES.map((n) => <option key={n} value={n} />)}</datalist>
          </div>
          <div className="space-y-1.5">
            <Label>Cidade</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex.: Campinas, SP" />
          </div>
          <div className="space-y-1.5">
            <Label>Bairro (opcional)</Label>
            <Input value={hood} onChange={(e) => setHood(e.target.value)} placeholder="Ex.: Cambuí" />
          </div>
        </div>
        )}
        <div className="mt-4 grid grid-cols-2 items-end gap-4 sm:grid-cols-3 lg:grid-cols-[auto_auto_auto_auto_1fr]">
          <div className="space-y-1.5">
            <Label>Nota mínima</Label>
            <Select value={minRating} onValueChange={setMinRating}>
              <SelectTrigger className="w-full sm:w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["0", "3", "3.5", "4", "4.5"].map((v) => <SelectItem key={v} value={v}>{v === "0" ? "Qualquer" : `${v}+`}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Site</Label>
            <Select value={site} onValueChange={(v) => setSite(v as typeof site)}>
              <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="sem">Sem site</SelectItem>
                <SelectItem value="com">Com site</SelectItem>
                <SelectItem value="social">Sem site ou só Instagram/WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5 sm:col-span-1">
            <Label>Total de avaliações (mín. e máx.)</Label>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
              <Input className="min-w-0 sm:w-20" type="number" min={0} placeholder="mín" value={minReviews} onChange={(e) => setMinReviews(e.target.value)} />
              <span className="text-muted-foreground">–</span>
              <Input className="min-w-0 sm:w-20" type="number" min={0} placeholder="máx" value={maxReviews} onChange={(e) => setMaxReviews(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Oportunidade</Label>
            <Select value={opp} onValueChange={setOpp}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="quente">Alta</SelectItem>
                <SelectItem value="morna">Média</SelectItem>
                <SelectItem value="fria">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" size="lg" className="col-span-2 w-full sm:col-span-1 lg:justify-self-end lg:w-auto" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar
          </Button>
        </div>
      </form>

      {searched && (
        <div className="mt-6 rounded-xl border bg-card p-4 text-sm" aria-live="polite">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 max-sm:grid-cols-1">
            <p>
              <span className="text-lg font-bold">{filtered.length}</span> de {results.length} empresas compatíveis com os filtros ·{" "}
              <span className="font-semibold text-hot">{semSite} sem site</span>
              {soSocial > 0 && <> · <span className="font-semibold text-hot">{soSocial} só com Instagram/WhatsApp</span></>}
            </p>
            <div className="flex flex-wrap gap-2">
              <SaveToBlock leads={filtered} niche={searched?.niche} city={searched?.city} />
              <Button type="button" size="sm" variant="outline" className="max-sm:w-full" disabled={filtered.length === 0} onClick={() => exportCsv(filtered)}>
                <Download className="h-4 w-4" /> Exportar CSV
              </Button>
            </div>
          </div>
          {breakdown.length > 0 && (
            <p className="mt-1 text-muted-foreground">Ocultadas: {breakdown.join(" · ")}.</p>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((l) => (
          <LeadCard key={l.placeId} lead={l} saved={savedMap.has(l.placeId)} onOpen={() => setOpen(l)} />
        ))}
      </div>

      {!searched && (
        <div className="mt-10 rounded-lg border border-dashed p-6 text-center text-muted-foreground sm:p-12">
          Escolha um nicho e uma cidade para começar.
        </div>
      )}
      {searched && results.length === 0 && (
        <p className="mt-10 text-center text-muted-foreground">Nenhuma empresa encontrada. Tente outra cidade (ex.: "Campinas, SP") ou um nicho mais simples.</p>
      )}
      {searched && results.length > 0 && filtered.length === 0 && (
        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <div>
            <p className="font-medium">Nenhuma das {results.length} empresas encontradas passa nos filtros atuais.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              O total de avaliações é um intervalo: uma empresa precisa ter pelo menos o mínimo e no máximo o máximo informado.
            </p>
          </div>
          {hasResultFilters && (
            <Button type="button" variant="outline" className="h-auto max-w-full whitespace-normal py-2 text-center" onClick={clearResultFilters}>
              <RotateCcw className="h-4 w-4" /> Limpar filtros e mostrar as {results.length} empresas
            </Button>
          )}
        </div>
      )}
      {token && (
        <div className="mt-8 text-center">
          <Button variant="outline" onClick={() => run(true)} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} {loading ? "Carregando empresas..." : "Carregar mais 20"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">Os filtros atuais continuam aplicados às novas empresas.</p>
        </div>
      )}
      {searched && !token && results.length > 0 && !loading && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Não há mais empresas para carregar nesta busca. {filtered.length} compatíveis com os filtros no total — tente outro bairro ou nicho para ver mais.
        </p>
      )}

      <LeadDialog
        lead={open}
        saved={open ? savedMap.get(open.placeId) ?? null : null}
        niche={searched?.niche}
        city={searched?.city}
        onClose={() => setOpen(null)}
      />
    </AppShell>
  );
}
