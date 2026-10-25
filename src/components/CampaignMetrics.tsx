import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";

type Row = { bloco: string; empresas: number; enviadas: number; falhas: number; pendentes: number };

async function load(): Promise<Row[]> {
  const [{ data: blocks }, { data: camps }, { data: sched }] = await Promise.all([
    supabase.from("lead_blocks").select("id,name,block_items(count)"),
    supabase.from("campaigns").select("id,block_id"),
    supabase.from("wa_scheduled").select("campaign_id,status").limit(10000),
  ]);
  const campBlock = new Map((camps ?? []).map((c) => [c.id, c.block_id ?? "sem"]));
  const rows = new Map<string, Row>();
  for (const b of blocks ?? []) {
    rows.set(b.id, { bloco: b.name, empresas: (b.block_items as unknown as { count: number }[])?.[0]?.count ?? 0, enviadas: 0, falhas: 0, pendentes: 0 });
  }
  for (const s of sched ?? []) {
    const key = s.campaign_id ? campBlock.get(s.campaign_id) ?? "sem" : "avulso";
    if (!rows.has(key)) rows.set(key, { bloco: key === "avulso" ? "Agendamentos avulsos" : "Sem bloco", empresas: 0, enviadas: 0, falhas: 0, pendentes: 0 });
    const r = rows.get(key)!;
    if (s.status === "enviada") r.enviadas++;
    else if (s.status === "falhou") r.falhas++;
    else if (s.status === "pendente" || s.status === "enviando") r.pendentes++;
  }
  return [...rows.values()].sort((a, b) => b.enviadas + b.falhas - (a.enviadas + a.falhas));
}

export function CampaignMetrics() {
  const { data = [], isLoading } = useQuery({ queryKey: ["metricas"], queryFn: load, refetchInterval: 60000 });
  const tot = data.reduce((a, r) => ({ e: a.e + r.enviadas, f: a.f + r.falhas, p: a.p + r.pendentes, c: a.c + r.empresas }), { e: 0, f: 0, p: 0, c: 0 });
  const rate = tot.e + tot.f ? Math.round((tot.f / (tot.e + tot.f)) * 100) : 0;
  const cards = [
    { l: "Mensagens enviadas", v: tot.e },
    { l: "Falhas", v: tot.f, s: `${rate}% dos envios` },
    { l: "Aguardando", v: tot.p },
    { l: "Empresas em blocos", v: tot.c },
  ];
  return (
    <>
      <div>
      <p className="text-muted-foreground">Envios, falhas e empresas por bloco de leads.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.l} className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">{c.l}</p>
            <p className="mt-1 font-display text-3xl font-bold">{c.v}</p>
            {c.s && <p className="text-xs text-muted-foreground">{c.s}</p>}
          </div>
        ))}
      </div>
      <section className="mt-6 rounded-lg border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">Por bloco</h2>
        {isLoading ? <p className="mt-2 text-sm text-muted-foreground">Carregando…</p> : data.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Ainda não há blocos ou envios.</p>
        ) : (
          <>
            <div className="mt-4 h-72 w-full">
              <ResponsiveContainer>
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="bloco" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
                  <Legend />
                  <Bar dataKey="empresas" name="Empresas" fill="var(--muted-foreground)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="enviadas" name="Enviadas" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="falhas" name="Falhas" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid gap-2">
              {data.map((r) => (
                <div key={r.bloco} className="grid grid-cols-2 gap-1 rounded-md border p-3 text-sm sm:grid-cols-5">
                  <b className="col-span-2 sm:col-span-1">{r.bloco}</b>
                  <span>{r.empresas} empresas</span><span>{r.enviadas} enviadas</span>
                  <span className="text-destructive">{r.falhas} falhas</span><span className="text-muted-foreground">{r.pendentes} aguardando</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div></>
  );
}
