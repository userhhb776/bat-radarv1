import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AgentAvatar } from "@/components/AgentAvatar";
import { listAgents, saveAgent } from "@/lib/agents.functions";
import { setAgentSquad } from "@/lib/agent-squad.functions";

export const Route = createFileRoute("/_authenticated/agts-01")({
  head: () => ({ meta: [
    { title: "AGTS - 01 — BatRadar" }, { name: "description", content: "Esquadrão de agentes prontos do BatRadar, cada um especialista numa abordagem." },
    { property: "og:title", content: "AGTS - 01 — BatRadar" }, { property: "og:description", content: "Agentes prontos especialistas em abordagem." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const list = useServerFn(listAgents);
  const save = useServerFn(saveAgent);
  const squad = useServerFn(setAgentSquad);
  const { data } = useQuery({ queryKey: ["agents"], queryFn: () => list() });
  const agents = ((data?.agents ?? []) as any[]).filter((a) => a.squad === "agts01");
  const toggle = async (a: any) => { await save({ data: { ...a, ai_key: undefined, active: !a.active } }); qc.invalidateQueries({ queryKey: ["agents"] }); };
  const back = async (a: any) => { await squad({ data: { id: a.id, squad: null } }); qc.invalidateQueries({ queryKey: ["agents"] }); toast.success(`${a.name} voltou para Agentes`); };
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-4 p-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Users className="h-6 w-6" /> AGTS - 01</h1>
          <p className="text-sm text-muted-foreground">Seu esquadrão pronto. Toque na foto para trocar.</p>
        </div>
        {!agents.length && <p className="text-muted-foreground">Nenhum agente aqui. Em Agentes, use "Mover p/ AGTS - 01".</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <article key={a.id} className="flex flex-col overflow-hidden rounded-2xl border bg-card">
              <div className="relative flex flex-col items-center gap-3 border-b bg-gradient-to-b from-primary/15 to-transparent p-5">
                <span className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[11px] ${a.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{a.active ? "em campo" : "desligado"}</span>
                <AgentAvatar id={a.id} name={a.name} url={a.avatar_url} editable className="h-24 w-24 border-2" />
                <div className="text-center">
                  <h2 className="font-bold leading-tight">{a.name}</h2>
                  <p className="text-xs text-muted-foreground">{a.instance || "sem número"}</p>
                </div>
              </div>
              <p className="line-clamp-3 flex-1 p-4 text-sm text-muted-foreground">{a.mission || a.ideal_client || "Sem missão definida."}</p>
              <div className="flex flex-wrap items-center gap-2 border-t p-3">
                <Switch checked={a.active} onCheckedChange={() => toggle(a)} aria-label="Ligar agente" />
                <Button size="sm" asChild className="ml-auto"><Link to="/agentes/$id" params={{ id: a.id }}>Abrir painel</Link></Button>
                <Button size="sm" variant="ghost" onClick={() => back(a)}>Tirar</Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
