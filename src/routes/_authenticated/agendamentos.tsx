import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/agendamentos")({
  head: () => ({ meta: [
    { title: "Agendamentos avulsos — BatRadar 5.7" }, { name: "description", content: "Envios de WhatsApp programados para empresas fora de campanhas." },
    { property: "og:title", content: "Agendamentos avulsos — BatRadar 5.7" }, { property: "og:description", content: "Abordagens individuais programadas por dia e horário." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: AgendamentosPage,
});

type Row = { id: string; name: string; phone: string; texts: string[]; send_at: string; status: string; error: string | null };
const LABEL: Record<string, string> = { pendente: "Agendada", enviando: "Enviando", enviada: "Enviada", falhou: "Falhou", cancelada: "Cancelada" };

function AgendamentosPage() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["wa_scheduled", "avulsos"], refetchInterval: 30000,
    queryFn: async () => ((await supabase.from("wa_scheduled").select("id,name,phone,texts,send_at,status,error").is("campaign_id", null).order("send_at", { ascending: false }).limit(500)).data ?? []) as Row[],
  });
  const groups = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of [...rows].reverse()) { const k = `${r.name}|${r.phone}`; m.set(k, [...(m.get(k) ?? []), r]); }
    return [...m.entries()].reverse();
  }, [rows]);

  async function cancel(ids: string[]) {
    const { error } = await supabase.from("wa_scheduled").delete().in("id", ids).eq("status", "pendente");
    if (error) { toast.error(error.message); return; }
    toast.success("Envio cancelado");
    qc.invalidateQueries({ queryKey: ["wa_scheduled"] });
  }

  return (
    <AppShell>
      <p className="text-xs font-semibold uppercase text-primary">Automação</p>
      <h1 className="text-3xl font-bold">Agendamentos avulsos</h1>
      <p className="mt-1 text-sm text-muted-foreground">Empresas que você programou direto pelo lead, fora de campanhas. Agende pelo botão "Agendar envio" ao abrir qualquer empresa.</p>
      {isLoading && <p className="mt-6 text-muted-foreground">Carregando…</p>}
      {!isLoading && groups.length === 0 && <p className="mt-6 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum agendamento avulso.</p>}
      <div className="mt-6 grid gap-3">
        {groups.map(([k, list]) => {
          const pend = list.filter((r) => r.status === "pendente");
          const sent = list.filter((r) => r.status === "enviada").length;
          return (
            <article key={k} className="rounded-lg border bg-card p-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold break-words">{list[0]!.name}</p>
                  <p className="text-xs text-muted-foreground">{list[0]!.phone} · {sent}/{list.length} enviadas · {new Date(list[0]!.send_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>
                </div>
                {pend.length > 0 && <Button size="sm" variant="ghost" onClick={() => cancel(pend.map((r) => r.id))}><Trash2 className="h-4 w-4" /> Cancelar</Button>}
              </div>
              <ol className="mt-2 grid gap-1 text-sm">
                {list.map((r, i) => (
                  <li key={r.id} className="rounded bg-muted px-2 py-1">
                    <span className="mr-2 text-xs font-semibold text-primary">{i + 1}. {LABEL[r.status] ?? r.status}</span>
                    <span className="whitespace-pre-wrap break-words">{r.texts.join(" ").slice(0, 160)}</span>
                    {r.error && <span className="block text-xs text-destructive">{r.error}</span>}
                  </li>
                ))}
              </ol>
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
