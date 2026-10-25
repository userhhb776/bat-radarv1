import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { buildModel, feats, learned, noReply, type Feat } from "@/lib/mining-model";

export const Route = createFileRoute("/_authenticated/aprendizado")({
  head: () => ({
    meta: [
      { title: "Aprendizado — BatRadar 5.7" },
      { name: "description", content: "O que o robô de Leads do dia aprendeu com suas escolhas." },
      { property: "og:title", content: "Aprendizado — BatRadar 5.7" },
      { property: "og:description", content: "Perfis salvos, descartados e fechados, com pontuação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

type Row = Feat & { place_id: string; status: string; source: string; last_contact_at: string | null };
const LABEL: Record<string, string> = {
  "rv:0": "menos de 30 avaliações", "rv:1": "30–80 avaliações", "rv:2": "80–200 avaliações", "rv:3": "200–500 avaliações", "rv:4": "500–1500 avaliações", "rv:5": "1500+ avaliações",
  "rt:0": "nota abaixo de 4,3", "rt:1": "nota 4,3–4,6", "rt:2": "nota 4,6–4,8", "rt:3": "nota 4,8+", "rt:x": "sem nota",
  "pres:social": "só Instagram/WhatsApp", "pres:site": "tem site", "pres:nada": "sem site nem rede",
  "shop:1": "fica em shopping", "shop:0": "fora de shopping", "multi:1": "parece rede/filial", "multi:0": "loja independente",
};
const label = (k: string) => LABEL[k] ?? (k.startsWith("n:") ? `nicho: ${k.slice(2)}` : `palavra "${k.slice(2)}"`);

function Page() {
  const { data, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["aprendizado"],
    queryFn: async () => {
      const [l, fb] = await Promise.all([
        supabase.from("leads").select("place_id,name,niche,address,rating,reviews_count,website,status,source,last_contact_at"),
        supabase.from("mining_feedback").select("place_id,name,niche,address,rating,reviews_count,website").eq("kind", "descartado"),
      ]);
      return { leads: ((l.data ?? []) as Row[]).filter((x) => x.source !== "externo"), discards: (fb.data ?? []).map((d) => ({ ...d, name: d.name ?? "" })) as (Feat & { place_id: string })[] };
    },
  });
  const [tab, setTab] = useState<"salvas" | "fecharam" | "descartadas">("salvas");
  const view = useMemo(() => {
    if (!data) return null;
    const m = buildModel(data.leads, data.discards);
    const keys = new Set([...m.pos.keys(), ...m.neg.keys()].filter((k) => !k.startsWith("w:")));
    const traits = [...keys].map((k) => ({ k, s: Math.log(((m.pos.get(k) ?? 0) + 0.5) / (m.P + 1)) - Math.log(((m.neg.get(k) ?? 0) + 0.5) / (m.N + 1)) }))
      .filter((t) => (m.pos.get(t.k) ?? 0) + (m.neg.get(t.k) ?? 0) >= 2).sort((a, b) => b.s - a.s);
    const sc = (c: Feat) => learned(c, m);
    const closed = data.leads.filter((x) => ["respondeu", "reuniao", "fechado"].includes(x.status));
    const saved = data.leads.filter((x) => ["novo", "enviada"].includes(x.status) && !noReply(x));
    const bad = [
      ...data.discards.map((d) => ({ ...d, why: "Descartada" })),
      ...data.leads.filter((x) => x.status === "perdido").map((x) => ({ ...x, why: "Perdida" })),
      ...data.leads.filter(noReply).map((x) => ({ ...x, why: "Sem resposta" })),
    ];
    return { m, traits, lists: { salvas: saved, fecharam: closed, descartadas: bad } as Record<string, (Feat & { place_id: string; why?: string; status?: string })[]>, sc, ready: m.P + m.N >= 5 };
  }, [data]);

  return (
    <AppShell>
      <div className="flex flex-wrap items-center gap-2"><h1 className="flex-1 text-3xl font-bold">Aprendizado</h1><Button size="sm" variant="outline" disabled={isFetching} onClick={() => refetch()}><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> {isFetching ? "Atualizando..." : "Atualizar"}</Button></div>
      <p className="mt-1 text-muted-foreground">O que o robô dos Leads do dia aprendeu com o que você salva, descarta, fecha e com quem não responde às campanhas.{dataUpdatedAt ? ` Atualizado às ${new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "numeric", minute: "2-digit", hour12: true })}.` : ""}</p>
      {!view ? <p className="mt-8 text-muted-foreground">Carregando…</p> : (
        <>
          {!view.ready && <p className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Ainda pouco dado: o aprendizado começa depois de umas 5 empresas salvas ou descartadas.</p>}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <h2 className="font-semibold text-primary">Perfis que funcionam</h2>
              <ul className="mt-2 space-y-1 text-sm">{view.traits.filter((t) => t.s > 0.2).slice(0, 8).map((t) => <li key={t.k} className="flex justify-between gap-2"><span>{label(t.k)}</span><span className="text-primary">+{t.s.toFixed(1)}</span></li>)}</ul>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h2 className="font-semibold text-destructive">Perfis que você evita</h2>
              <ul className="mt-2 space-y-1 text-sm">{view.traits.filter((t) => t.s < -0.2).reverse().slice(0, 8).map((t) => <li key={t.k} className="flex justify-between gap-2"><span>{label(t.k)}</span><span className="text-destructive">{t.s.toFixed(1)}</span></li>)}</ul>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {(["salvas", "fecharam", "descartadas"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-full border px-3 py-1 text-sm ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                {{ salvas: "Salvas", fecharam: "Responderam / fecharam", descartadas: "Descartadas / sem resposta" }[t]} ({view.lists[t]!.length})
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {view.lists[tab]!.map((c) => { const s = view.sc(c); return (
              <div key={c.place_id + (c.why ?? "")} className="min-w-0 rounded-lg border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="break-words font-medium">{c.name}</p>
                  <span className={`shrink-0 text-sm font-semibold ${s >= 0 ? "text-primary" : "text-destructive"}`}>{s >= 0 ? "+" : ""}{s.toFixed(1)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{c.why ?? c.status} · ★ {c.rating ?? "—"} · {c.reviews_count ?? 0} avaliações</p>
                <div className="mt-2 flex flex-wrap gap-1">{feats(c).filter((k) => !k.startsWith("w:") && !k.startsWith("n:")).map((k) => <span key={k} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{label(k)}</span>)}</div>
              </div>); })}
          </div>
          <p className="mt-6 text-xs text-muted-foreground">Pontuação: positivo = parece com o que você aproveita; negativo = parece com o que você descarta. Abaixo de −2,5 o robô nem traz.</p>
        </>
      )}
    </AppShell>
  );
}
