import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, MapPin, Star, ExternalLink, Check, RefreshCw, Bell } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { LeadDialog } from "@/components/LeadDialog";
import { SaveToBlock } from "@/components/SaveToBlock";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { leadsKey, listLeads, recordDiscard } from "@/lib/leads";
import { isSocialLink, NICHE_GROUPS } from "@/lib/niches";
import { STATES } from "@/lib/mining-options";
import { regenerateDaily } from "@/lib/mining.functions";
import { enablePush, pushMessages } from "@/lib/push-client";

const ANY = "__any";
async function getSettings() {
  const { data } = await supabase.from("user_settings").select("mining_enabled, niche_filter, state_filter").maybeSingle();
  return data;
}
import type { PlaceLead } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/diarios")({
  head: () => ({
    meta: [
      { title: "Leads do dia — BatRadar 5.7" },
      { name: "description", content: "15 empresas sem site garimpadas automaticamente todos os dias." },
      { property: "og:title", content: "Leads do dia — BatRadar 5.7" },
      { property: "og:description", content: "Empresas sem site ou só com Instagram/WhatsApp, prontas para abordar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiariosPage,
});

type Daily = { id: string; place_id: string; name: string; phone: string | null; address: string | null; website: string | null; rating: number | null; reviews_count: number; niche: string | null; city: string | null; maps_url: string | null; found_on: string };

async function listDaily(): Promise<Daily[]> {
  const { data, error } = await supabase.from("daily_leads").select("*").order("found_on", { ascending: false }).order("created_at");
  if (error) throw error;
  return data as unknown as Daily[];
}

const toPlace = (d: Daily): PlaceLead => ({ placeId: d.place_id, name: d.name, phone: d.phone, intlPhone: d.phone, address: d.address, website: d.website, rating: d.rating, reviews: d.reviews_count, mapsUrl: d.maps_url });

function DiariosPage() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({ queryKey: ["daily_leads"], queryFn: listDaily });
  const { data: saved = [] } = useQuery({ queryKey: leadsKey, queryFn: listLeads });
  const savedMap = useMemo(() => new Map(saved.map((s) => [s.place_id, s])), [saved]);
  const [open, setOpen] = useState<Daily | null>(null);

  const days = useMemo(() => {
    const m = new Map<string, Daily[]>();
    for (const i of items) m.set(i.found_on, [...(m.get(i.found_on) ?? []), i]);
    return [...m.entries()];
  }, [items]);

  async function discard(id: string) {
    const d = items.find((x) => x.id === id);
    if (d && !savedMap.has(d.place_id)) await recordDiscard(d);
    const { error } = await supabase.from("daily_leads").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["daily_leads"] });
  }

  const { data: settings } = useQuery({ queryKey: ["user_settings"], queryFn: getSettings });
  async function saveSettings(patch: { mining_enabled?: boolean; niche_filter?: string | null; state_filter?: string | null }) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("user_settings").upsert({ user_id: u.user.id, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["user_settings"] });
    if (patch.mining_enabled !== undefined) toast.success(patch.mining_enabled ? "Busca diária ligada" : "Busca diária desligada");
  }

  const regenFn = useServerFn(regenerateDaily);
  const [regen, setRegen] = useState(false);
  async function regenerate() {
    setRegen(true);
    try {
      const r = await regenFn();
      if (r.count) toast.success(`${r.count} empresas novas no lugar das de hoje`);
      else toast.error("Nenhuma empresa nova encontrada com esses filtros. Tente outro nicho ou estado.");
      qc.invalidateQueries({ queryKey: ["daily_leads"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Falha ao buscar: ${JSON.stringify(e)}`);
    } finally {
      setRegen(false);
    }
  }

  async function notify() {
    const r = await enablePush();
    (r === "registered" ? toast.success : toast.error)(pushMessages[r]);
  }

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold">Leads do dia</h1>
        <Button size="icon" variant="outline" aria-label="Buscar novas empresas" title="Buscar novas empresas (substitui as de hoje)" disabled={regen} onClick={regenerate}>
          <RefreshCw className={`h-4 w-4 ${regen ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <p className="mt-1 text-muted-foreground">Todo dia à meia-noite o BatRadar garimpa 15 empresas sem site ou só com Instagram/WhatsApp.</p>

      <div className="mt-4 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Switch checked={settings?.mining_enabled ?? true} onCheckedChange={(v) => saveSettings({ mining_enabled: v })} />
          {settings?.mining_enabled === false ? "Desligado" : "Ligado"}
        </label>
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Nicho (opcional)</span>
          <Select value={settings?.niche_filter ?? ANY} onValueChange={(v) => saveSettings({ niche_filter: v === ANY ? null : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Qualquer nicho</SelectItem>
              {Object.entries(NICHE_GROUPS).map(([g, list]) => (
                <SelectGroup key={g}>
                  <SelectLabel>{g}</SelectLabel>
                  <SelectItem value={g}>Todo o grupo {g}</SelectItem>
                  {list.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Estado (opcional)</span>
          <Select value={settings?.state_filter ?? ANY} onValueChange={(v) => saveSettings({ state_filter: v === ANY ? null : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Qualquer estado</SelectItem>
              {STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={notify}><Bell className="mr-2 h-4 w-4" /> Notificações</Button>
        <div className="sm:col-span-4"><SaveToBlock leads={items.map(toPlace)} /></div>
      </div>

      {isLoading && <p className="mt-8 text-muted-foreground">Carregando…</p>}
      {!isLoading && items.length === 0 && (
        <div className="mt-10 rounded-lg border border-dashed p-6 text-center text-muted-foreground sm:p-12">
          Ainda não há empresas. A primeira leva chega na próxima meia-noite.
        </div>
      )}

      {days.map(([day, list]) => (
        <section key={day} className="mt-8">
          <h2 className="mb-3 font-display text-lg font-semibold">
            {new Date(day + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} · {list.length}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((d) => {
              const inPipe = savedMap.has(d.place_id);
              return (
                <div key={d.id} className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-4">
                  <button type="button" className="min-w-0 text-left" onClick={() => setOpen(d)}>
                    <p className="break-words font-semibold hover:text-primary">{d.name}</p>
                    <p className="text-sm text-muted-foreground">{d.niche} · {d.city}</p>
                  </button>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded bg-hot/15 px-2 py-0.5 font-medium text-hot">{d.website && isSocialLink(d.website) ? "Só Instagram/WhatsApp" : "Sem site"}</span>
                    <span className="inline-flex items-center gap-1 text-muted-foreground"><Star className="h-3 w-3" /> {d.rating?.toFixed(1) ?? "—"} · {d.reviews_count}</span>
                    {inPipe && <span className="inline-flex items-center gap-1 text-primary"><Check className="h-3 w-3" /> No pipeline</span>}
                  </div>
                  {d.address && <p className="flex gap-1 text-xs text-muted-foreground"><MapPin className="mt-0.5 h-3 w-3 shrink-0" /><span className="break-words">{d.address}</span></p>}
                  <div className="mt-auto grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 pt-1">
                    <Button size="sm" onClick={() => setOpen(d)}>Abordar</Button>
                    {d.maps_url && (
                      <Button size="sm" variant="outline" asChild><a href={d.maps_url} target="_blank" rel="noreferrer" aria-label="Google Maps"><ExternalLink className="h-4 w-4" /></a></Button>
                    )}
                    <Button size="sm" variant="ghost" aria-label="Descartar" onClick={() => discard(d.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <LeadDialog
        lead={open ? toPlace(open) : null}
        saved={open ? savedMap.get(open.place_id) ?? null : null}
        niche={open?.niche ?? undefined}
        city={open?.city ?? undefined}
        onClose={() => setOpen(null)}
      />
    </AppShell>
  );
}
