import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { jarvisNewToken } from "@/lib/jarvis.functions";

export const Route = createFileRoute("/_authenticated/jarvis")({
  head: () => ({ meta: [
    { title: "Jarvis — Acesso do assistente | BatRadar" }, { name: "description", content: "Gere o token para o seu assistente Jarvis buscar leads e criar campanhas." },
    { property: "og:title", content: "Jarvis — Acesso do assistente" }, { property: "og:description", content: "Token e endereço para conectar o Jarvis ao BatRadar." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});

const URL_API = "https://bat-radar.lovable.app/api/public/jarvis";

function Page() {
  const qc = useQueryClient();
  const gen = useServerFn(jarvisNewToken);
  const [token, setToken] = useState<string | null>(null);
  const { data: cur } = useQuery({ queryKey: ["jarvis_token"], queryFn: async () => (await supabase.from("jarvis_tokens").select("created_at,last_used_at").maybeSingle()).data });
  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("Copiado"); };
  async function create() {
    if (cur && !confirm("Gerar um novo token? O antigo para de funcionar.")) return;
    const r = await gen(); setToken(r.token); qc.invalidateQueries({ queryKey: ["jarvis_token"] });
  }
  async function revoke() {
    if (!confirm("Desligar o acesso do Jarvis?")) return;
    await supabase.from("jarvis_tokens").delete().neq("user_id", "00000000-0000-0000-0000-000000000000");
    setToken(null); qc.invalidateQueries({ queryKey: ["jarvis_token"] });
  }
  return (
    <AppShell>
      <p className="text-xs font-semibold uppercase text-primary">Integração</p>
      <h1 className="text-3xl font-bold">Jarvis</h1>
      <p className="mt-1 text-sm text-muted-foreground">Deixe seu assistente buscar leads, montar blocos e lançar campanhas por você.</p>
      <div className="mt-6 grid gap-4 rounded-lg border p-4">
        <div><p className="text-sm font-semibold">Endereço</p>
          <div className="mt-1 flex items-center gap-2"><code className="break-all rounded bg-muted px-2 py-1 text-xs">{URL_API}</code><Button size="icon" variant="ghost" onClick={() => copy(URL_API)}><Copy className="h-4 w-4" /></Button></div></div>
        <div><p className="text-sm font-semibold">Token</p>
          <p className="text-xs text-muted-foreground">{cur ? `Ativo desde ${new Date(cur.created_at).toLocaleString("pt-BR")}${cur.last_used_at ? ` · último uso ${new Date(cur.last_used_at).toLocaleString("pt-BR")}` : " · ainda não usado"}` : "Nenhum token ativo."}</p>
          {token && <div className="mt-2 rounded-md border border-primary/40 bg-primary/10 p-3">
            <p className="text-xs text-primary">Copie agora — ele não aparece de novo.</p>
            <div className="mt-1 flex items-center gap-2"><code className="break-all text-xs">{token}</code><Button size="icon" variant="ghost" onClick={() => copy(token)}><Copy className="h-4 w-4" /></Button></div></div>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={create}><KeyRound className="h-4 w-4" /> {cur ? "Gerar novo token" : "Gerar token"}</Button>
            {cur && <Button variant="outline" onClick={revoke}><Trash2 className="h-4 w-4" /> Desligar acesso</Button>}
          </div></div>
      </div>
    </AppShell>
  );
}
