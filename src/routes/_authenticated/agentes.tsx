import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bot, Flame, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listAgents, saveAgent, deleteAgent, agentConversations, talkToAgent, designAgent } from "@/lib/agents.functions";
import { waList } from "@/lib/whatsapp.functions";
import { AgentWizard } from "@/components/AgentWizard";

export const Route = createFileRoute("/_authenticated/agentes")({
  head: () => ({ meta: [
    { title: "Agentes — BatRadar" }, { name: "description", content: "Crie agentes que mineram, abordam, respondem clientes e avisam você." },
    { property: "og:title", content: "Agentes — BatRadar" }, { property: "og:description", content: "Agentes de vendas autônomos treinados por você." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});

type A = { id?: string; name: string; mission: string; offer: string; rules: string; ideal_client: string; learned?: string; instance: string; ai_provider: "native" | "custom"; ai_key?: string; model: string; active: boolean; auto_reply: boolean; training_mode: boolean };
const blank: A = { name: "", mission: "", offer: "", rules: "", ideal_client: "", instance: "", ai_provider: "native", ai_key: "", model: "gpt-oss:120b", active: false, auto_reply: true, training_mode: false };

function Page() {
  const qc = useQueryClient();
  const list = useServerFn(listAgents);
  const wa = useServerFn(waList);
  const { data } = useQuery({ queryKey: ["agents"], queryFn: () => list() });
  const { data: inst = [] } = useQuery({ queryKey: ["wa_instances"], queryFn: () => wa(), retry: 1 });
  const [edit, setEdit] = useState<A | null>(null);
  const agents = (data?.agents ?? []) as any[];
  const save = useServerFn(saveAgent);
  const toggle = async (a: any) => { await save({ data: { ...a, ai_key: undefined, active: !a.active } }); qc.invalidateQueries({ queryKey: ["agents"] }); };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Bot className="h-6 w-6" /> Agentes</h1>
          <Button onClick={() => setEdit({ ...blank })}><Plus className="mr-1 h-4 w-4" />Novo agente</Button>
        </div>
        {edit && <AgentWizard key={edit.id ?? "novo"} a={edit} admin={!!data?.admin} inst={inst} onClose={() => setEdit(null)} />}
        {!agents.length && !edit && <p className="text-muted-foreground">Nenhum agente ainda. Crie o primeiro e treine com suas regras.</p>}
        <div className="grid gap-3">
          {agents.map((a) => (
            <div key={a.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/30 bg-primary/10 font-bold">{a.avatar_url ? <img src={a.avatar_url} alt={a.name} className="h-full w-full object-cover" /> : a.name.slice(0, 2).toUpperCase()}</div><div><div className="font-semibold">{a.name}</div><div className="text-xs text-muted-foreground">{a.instance || "sem número"} · {a.ai_provider === "custom" ? "IA própria" : "IA nativa"}{a.training_mode ? " · treinamento ligado" : ""}</div></div></div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={a.active} onCheckedChange={() => toggle(a)} aria-label="Ativar agente" />
                  <Button size="sm" variant="outline" onClick={() => setEdit({ ...a })}>Configurar</Button>
                  <Button size="sm" asChild><Link to="/agentes/$id" params={{ id: a.id }}>Abrir painel</Link></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="space-y-1"><Label>{label}</Label>{children}</div>;
const Toggle = ({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) => <label className="flex items-center justify-between gap-3 text-sm"><span>{label}</span><Switch checked={v} onCheckedChange={on} /></label>;

