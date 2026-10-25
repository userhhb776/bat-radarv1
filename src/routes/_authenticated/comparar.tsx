import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Crosshair, Star, Phone, MapPin, GlobeLock, Globe } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LeadDialog, } from "@/components/LeadDialog";
import { OpportunityBadge } from "@/components/LeadCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { searchPlaces } from "@/lib/places.functions";
import { leadsKey, listLeads } from "@/lib/leads";
import type { PlaceLead } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/comparar")({
  head: () => ({
    meta: [
      { title: "Comparar concorrentes — BatRadar 5.7" },
      { name: "description", content: "Compare empresas do mesmo nicho e descubra qual abordar primeiro." },
      { property: "og:title", content: "Comparar concorrentes — BatRadar 5.7" },
      { property: "og:description", content: "Nota, avaliações, endereço e telefone lado a lado com prioridade de abordagem." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CompararPage,
});

/** Prioridade 0–100: maior = abordar antes. Sem site pesa mais; perfil fraco perto de concorrentes fortes também. */
function priority(l: PlaceLead, avgReviews: number) {
  let s = 0;
  if (!l.website) s += 45;
  const r = l.rating ?? 0;
  if (r > 0 && r < 4.2) s += 15;
  if (l.reviews < avgReviews) s += Math.min(25, Math.round(((avgReviews - l.reviews) / Math.max(avgReviews, 1)) * 25));
  if (l.phone) s += 10;
  if (l.reviews >= 10) s += 5; // negócio ativo, vale o contato
  return Math.min(100, s);
}

function reason(l: PlaceLead, avgReviews: number) {
  const r: string[] = [];
  if (!l.website) r.push("sem site");
  if ((l.rating ?? 5) < 4.2) r.push("nota abaixo de 4,2");
  if (l.reviews < avgReviews) r.push(`${Math.round(avgReviews - l.reviews)} avaliações abaixo da média`);
  if (!l.phone) r.push("sem telefone");
  return r.length ? r.join(" · ") : "bem posicionada frente aos concorrentes";
}

type SortKey = "prioridade" | "nota" | "avaliacoes";

function CompararPage() {
  const search = useServerFn(searchPlaces);
  const { data: saved = [] } = useQuery({ queryKey: leadsKey, queryFn: listLeads });
  const [niche, setNiche] = useState("");
  const [city, setCity] = useState("");
  const [rows, setRows] = useState<PlaceLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<SortKey>("prioridade");
  const [open, setOpen] = useState<PlaceLead | null>(null);
  const [ctx, setCtx] = useState<{ niche: string; city: string } | null>(null);

  async function run() {
    if (niche.trim().length < 2 || city.trim().length < 2) { toast.error("Informe nicho e cidade."); return; }
    setLoading(true);
    try {
      const r = await search({ data: { niche, city, neighborhood: "", minRating: 0 } });
      setRows(r.leads);
      setCtx({ niche, city });
      if (!r.leads.length) toast.info("Nenhuma empresa encontrada.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const avgReviews = rows.length ? rows.reduce((a, b) => a + b.reviews, 0) / rows.length : 0;
  const rated = rows.filter((r) => r.rating);
  const avgRating = rated.length ? rated.reduce((a, b) => a + (b.rating ?? 0), 0) / rated.length : 0;
  const maxReviews = Math.max(1, ...rows.map((r) => r.reviews));

  const sorted = useMemo(() => {
    const list = rows.map((l) => ({ l, p: priority(l, avgReviews) }));
    list.sort((a, b) =>
      sort === "prioridade" ? b.p - a.p : sort === "nota" ? (a.l.rating ?? 0) - (b.l.rating ?? 0) : a.l.reviews - b.l.reviews,
    );
    return list;
  }, [rows, sort, avgReviews]);

  const savedMap = new Map(saved.map((s) => [s.place_id, s]));

  return (
    <AppShell>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Análise de território</p>
      <h1 className="mt-2 text-3xl font-bold">Comparar concorrentes</h1>
      <p className="mt-1 text-muted-foreground">Veja as empresas do mesmo nicho lado a lado e descubra quem abordar primeiro.</p>

      <form
        onSubmit={(e) => { e.preventDefault(); run(); }}
        className="mt-6 grid gap-4 rounded-lg border bg-card p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
      >
         <div className="min-w-0 space-y-1.5">
          <Label>Nicho</Label>
          <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Ex.: Clínica odontológica" />
        </div>
         <div className="min-w-0 space-y-1.5">
          <Label>Cidade</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex.: Campinas, SP" />
        </div>
        <Button type="submit" disabled={loading} className="self-end">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />} Comparar
        </Button>
      </form>

      {rows.length > 0 && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {[
              ["Empresas", rows.length.toString()],
              ["Nota média", avgRating.toFixed(1).replace(".", ",")],
              ["Avaliações (média)", Math.round(avgReviews).toString()],
              ["Sem site", rows.filter((r) => !r.website).length.toString()],
            ].map(([k, v]) => (
               <div key={k} className="min-w-0 rounded-lg border bg-card p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{k}</p>
                <p className="mt-1 font-display text-2xl font-bold">{v}</p>
              </div>
            ))}
          </div>

           <div className="mt-6 grid grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
             <p className="min-w-0 text-sm text-muted-foreground">Selecione uma empresa para auditar e gerar a mensagem.</p>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
               <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="prioridade">Ordenar: prioridade</SelectItem>
                <SelectItem value="nota">Ordenar: menor nota</SelectItem>
                <SelectItem value="avaliacoes">Ordenar: menos avaliações</SelectItem>
              </SelectContent>
            </Select>
          </div>

           <div className="mt-3 grid gap-3 md:hidden">
             {sorted.map(({ l, p }, i) => (
               <Button key={l.placeId} variant="outline" onClick={() => setOpen(l)} className="h-auto w-full min-w-0 flex-col items-stretch gap-3 whitespace-normal rounded-lg p-4 text-left">
                 <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                   <div className="min-w-0">
                     <p className="break-words font-semibold">{i + 1}. {l.name}</p>
                     <p className="mt-1 text-xs text-muted-foreground">{l.website ? "Com site" : "Sem site"}{savedMap.has(l.placeId) ? " · salvo" : ""}</p>
                   </div>
                   <span className="shrink-0 text-accent">{p} pts</span>
                 </div>
                 <div className="grid grid-cols-2 gap-2 text-sm">
                   <span><Star className="mr-1 inline h-3.5 w-3.5 text-warm" />{l.rating?.toFixed(1) ?? "—"} nota</span>
                   <span>{l.reviews} avaliações</span>
                 </div>
                 <p className="break-words text-sm text-muted-foreground"><Phone className="mr-1 inline h-3.5 w-3.5" />{l.phone ?? "Sem telefone"}</p>
                 <p className="break-words text-sm text-muted-foreground"><MapPin className="mr-1 inline h-3.5 w-3.5" />{l.address}</p>
                 <p className="text-xs text-muted-foreground">{reason(l, avgReviews)}</p>
               </Button>
             ))}
           </div>
           <div className="mt-3 hidden overflow-x-auto rounded-lg border bg-card md:block">
             <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3">#</th><th className="p-3">Empresa</th><th className="p-3">Nota</th>
                  <th className="p-3">Avaliações</th><th className="p-3">Telefone</th><th className="p-3">Endereço</th>
                  <th className="p-3">Prioridade</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(({ l, p }, i) => (
                  <tr key={l.placeId} onClick={() => setOpen(l)} className={cn("cursor-pointer border-b last:border-0 hover:bg-muted/60", i === 0 && sort === "prioridade" && "bg-accent/5")}>
                    <td className="p-3 font-display font-bold text-muted-foreground">{i + 1}</td>
                    <td className="p-3">
                      <p className="font-semibold">{l.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        {l.website ? <Globe className="h-3 w-3" /> : <GlobeLock className="h-3 w-3 text-hot" />}
                        {l.website ? "Com site" : <span className="text-hot">Sem site</span>}
                        {savedMap.has(l.placeId) && <span className="ml-2 text-accent">· salvo</span>}
                      </p>
                    </td>
                    <td className="p-3">
                      <span className={cn("flex items-center gap-1 font-semibold", (l.rating ?? 0) < avgRating && "text-hot")}>
                        <Star className="h-3.5 w-3.5 fill-warm text-warm" /> {l.rating?.toFixed(1) ?? "—"}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="font-semibold">{l.reviews}</span>
                      <div className="mt-1 h-1.5 w-24 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${(l.reviews / maxReviews) * 100}%` }} />
                      </div>
                    </td>
                    <td className="p-3 whitespace-nowrap"><Phone className="mr-1 inline h-3 w-3" />{l.phone ?? "—"}</td>
                    <td className="max-w-[240px] p-3 text-muted-foreground"><MapPin className="mr-1 inline h-3 w-3" />{l.address}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-lg font-bold text-accent">{p}</span>
                        <OpportunityBadge lead={l} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{reason(l, avgReviews)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <LeadDialog
        lead={open}
        saved={open ? savedMap.get(open.placeId) ?? null : null}
        niche={ctx?.niche}
        city={ctx?.city}
        onClose={() => setOpen(null)}
      />
    </AppShell>
  );
}
