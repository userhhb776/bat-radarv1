import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Rocket } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { listAgents, saveAgent } from "@/lib/agents.functions";
import { waList } from "@/lib/whatsapp.functions";
import { AgentWizard } from "@/components/AgentWizard";
import { AgentAvatar } from "@/components/AgentAvatar";
import { setAgentSquad } from "@/lib/agent-squad.functions";

export const Route = createFileRoute("/_authenticated/agentes-v3")({
  head: () => ({ meta: [
    { title: "Agentes V3 — BatRadar" }, { name: "description", content: "Agentes que prospectam empresas para outros serviços, escolhendo pelo engajamento." },
    { property: "og:title", content: "Agentes V3 — BatRadar" }, { property: "og:description", content: "Prospecção por engajamento, sem depender de site." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});

const blank = { name: "", mission: "", offer: "", rules: "", ideal_client: "", instance: "", ai_provider: "native" as const, ai_key: "", model: "gpt-oss:120b", active: false, auto_reply: true, training_mode: false };

function Page() {
  const qc = useQueryClient();
  const list = useServerFn(listAgents);
  const wa = useServerFn(waList);
  const save = useServerFn(saveAgent);
  const squad = useServerFn(setAgentSquad);
  const { data } = useQuery({ queryKey: ["agents"], queryFn: () => list() });
  const { data: inst = [] } = useQuery({ queryKey: ["wa_instances"], queryFn: () => wa(), retry: 1 });
  const [edit, setEdit] = useState<any | null>(null);
  const all = (data?.agents ?? []) as any[];
  const agents = all.filter((a) => a.squad === "v3");
  const free = all.filter((a) => !a.squad);
  const toggle = async (a: any) => { await save({ data: { ...a, ai_key: undefined, active: !a.active } }); qc.invalidateQueries({ queryKey: ["agents"] }); };
  const move = async (a: any, to: "v3" | null) => { await squad({ data: { id: a.id, squad: to } }); qc.invalidateQueries({ queryKey: ["agents"] }); toast.success(to ? `${a.name} agora é V3` : `${a.name} voltou para Agentes`); };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold"><Rocket className="h-6 w-6" /> Agentes V3</h1>
            <p className="text-sm text-muted-foreground">Para vender outros serviços (ex.: lista de clientes). O minerador não olha se a empresa tem site: escolhe as mais movimentadas, com 30+ avaliações e fotos.</p>
          </div>
          <Button onClick={() => setEdit({ ...blank })}><Plus className="mr-1 h-4 w-4" />Novo agente V3</Button>
        </div>
        {edit && <AgentWizard key="novo-v3" a={edit} admin={!!data?.admin} inst={inst} onClose={() => { setEdit(null); qc.invalidateQueries({ queryKey: ["agents"] }); toast("Depois de criar, use \"Trazer para V3\" abaixo."); }} />}
        {!agents.length && !edit && <p className="text-muted-foreground">Nenhum agente V3 ainda.</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <article key={a.id} className="flex flex-col overflow-hidden rounded-2xl border bg-card">
              <div className="flex flex-col items-center gap-2 border-b p-5">
                <AgentAvatar id={a.id} name={a.name} url={a.avatar_url} editable className="h-20 w-20 border-2" />
                <h2 className="font-bold">{a.name}</h2>
                <p className="text-xs text-muted-foreground">{a.instance || "sem número"} · {a.active ? "ligado" : "desligado"}</p>
              </div>
              <p className="line-clamp-3 flex-1 p-4 text-sm text-muted-foreground">{a.mission || a.offer || "Sem missão definida."}</p>
              <div className="flex flex-wrap items-center gap-2 border-t p-3">
                <Switch checked={a.active} onCheckedChange={() => toggle(a)} aria-label="Ligar agente" />
                <Button size="sm" variant="outline" onClick={() => setEdit({ ...a })}>Configurar</Button>
                <Button size="sm" asChild className="ml-auto"><Link to="/agentes/$id" params={{ id: a.id }}>Abrir painel</Link></Button>
                <Button size="sm" variant="ghost" onClick={() => move(a, null)}>Tirar</Button>
              </div>
            </article>
          ))}
        </div>
        {free.length > 0 && (
          <div className="rounded-xl border p-4">
            <h2 className="mb-2 text-sm font-semibold">Trazer da aba Agentes</h2>
            <div className="flex flex-wrap gap-2">
              {free.map((a) => <Button key={a.id} size="sm" variant="outline" onClick={() => move(a, "v3")}>{a.name} → V3</Button>)}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
