import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bot, Database, Loader2, Palette, RefreshCw, Server } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { getDashStyle, getSound, playBoot, setDashStyle, setSound, type DashStyle } from "@/lib/ui-prefs";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { getSystemStatus, saveAiKey, saveRenderServer } from "@/lib/status.functions";

export const Route = createFileRoute("/_authenticated/sistema")({
  head: () => ({
    meta: [
      { title: "Sistema — BatRadar 5.7" },
      { name: "description", content: "Uso do banco de dados, servidor do WhatsApp e IA, com troca de servidor e chaves." },
      { property: "og:title", content: "Sistema — BatRadar 5.7" },
      { property: "og:description", content: "Veja limites e troque servidor e chaves pelo painel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SistemaPage,
});

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;

function Dot({ ok }: { ok: boolean }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? "bg-primary" : "bg-destructive"}`} />;
}

function Box({ icon: Icon, title, children }: { icon: typeof Database; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-4 text-card-foreground">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><Icon className="h-5 w-5" />{title}</h2>
      <div className="space-y-3 text-sm">{children}</div>
    </section>
  );
}

function SistemaPage() {
  const statusFn = useServerFn(getSystemStatus);
  const renderFn = useServerFn(saveRenderServer);
  const aiFn = useServerFn(saveAiKey);
  const q = useQuery({ queryKey: ["system-status"], queryFn: () => statusFn(), staleTime: 60000, retry: false });
  const [url, setUrl] = useState("");
  const [rkey, setRkey] = useState("");
  const [akey, setAkey] = useState("");
  const [busy, setBusy] = useState<"" | "r" | "a">("");
  const [dash, setDash] = useState<DashStyle>("radar");
  const [snd, setSnd] = useState(false);
  useEffect(() => { setDash(getDashStyle()); setSnd(getSound()); }, []);

  async function swapRender(e: React.FormEvent) {
    e.preventDefault(); setBusy("r");
    try { const r = await renderFn({ data: { url, key: rkey } }); toast.success(`Servidor trocado · ${r.connected}/${r.instances} WhatsApps conectados`); setUrl(""); setRkey(""); q.refetch(); }
    catch (err) { toast.error((err as Error).message); } finally { setBusy(""); }
  }
  async function swapAi(e: React.FormEvent) {
    e.preventDefault(); setBusy("a");
    try { await aiFn({ data: { key: akey } }); toast.success("Chave da IA trocada"); setAkey(""); q.refetch(); }
    catch (err) { toast.error((err as Error).message); } finally { setBusy(""); }
  }

  const d = q.data;
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-bold">Sistema</h1>
          <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
            {q.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Atualizar
          </Button>
        </div>
        <Box icon={Palette} title="Aparência do painel">
          <Label>Modelo da tela de Início</Label>
          <div className="grid grid-cols-2 gap-2">
            {([["classico", "Clássico", "Limpo, com saudação do horário"], ["radar", "Radar", "Radar girando com o morcego"]] as const).map(([v, t, s]) => (
              <button key={v} type="button" onClick={() => { setDashStyle(v); setDash(v); }} className={`rounded-lg border p-3 text-left transition ${dash === v ? "border-primary bg-primary/10" : "hover:border-primary/50"}`}>
                <b>{t}</b><p className="text-xs text-muted-foreground">{s}</p>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 border-t pt-3">
            <div><p className="font-medium">Som ao toque</p><p className="text-xs text-muted-foreground">Bipe tecnológico ao tocar em opções e ao abrir o Início</p></div>
            <Switch checked={snd} onCheckedChange={(v) => { setSound(v); setSnd(v); if (v) playBoot(true); }} />
          </div>
        </Box>
        {q.isLoading && <p className="text-muted-foreground">Verificando tudo… (o servidor pode levar até 50s para acordar)</p>}
        {q.error && <p className="text-destructive">{(q.error as Error).message}</p>}
        {d && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Box icon={Database} title="Banco de dados">
              <p><b>{mb(d.db.bytes)}</b> de {mb(d.db.limit)} usados</p>
              <Progress value={Math.min(100, (d.db.bytes / d.db.limit) * 100)} />
              <p className="text-muted-foreground">Faltam {mb(Math.max(0, d.db.limit - d.db.bytes))} ({(100 - (d.db.bytes / d.db.limit) * 100).toFixed(1)}%). No plano gratuito o banco pausa após 7 dias sem uso.</p>
              <ul className="space-y-1">
                {d.db.tables.map((t) => (
                  <li key={t.name} className="flex justify-between gap-2"><span className="truncate">{t.name}</span><span className="text-muted-foreground">{Math.max(0, t.rows)} linhas · {mb(t.bytes)}</span></li>
                ))}
              </ul>
            </Box>

            <Box icon={Server} title="Servidor do WhatsApp (Render)">
              <p className="flex items-center gap-2"><Dot ok={d.render.ok} />{d.render.ok ? `Online · respondeu em ${(d.render.ms / 1000).toFixed(1)}s` : d.render.error}</p>
              <p className="break-all text-muted-foreground">{d.render.url || "—"} · chave {d.render.keyMask || "—"}</p>
              <p>WhatsApps: <b>{d.render.connected}</b> conectados de {d.render.instances}</p>
              <p>Horas gratuitas do mês: ~{d.render.hoursUsed} de {d.render.hoursLimit}</p>
              <Progress value={Math.min(100, (d.render.hoursUsed / d.render.hoursLimit) * 100)} />
              <p className="text-muted-foreground">Renova em <b>{d.render.daysToReset} dias</b> ({new Date(d.render.resetOn).toLocaleDateString("pt-BR")}). Estimativa considerando o servidor ligado o tempo todo.</p>
              <form onSubmit={swapRender} className="space-y-2 border-t pt-3">
                <Label>Trocar servidor</Label>
                <Input placeholder="https://novo-servidor.onrender.com" value={url} onChange={(e) => setUrl(e.target.value)} required />
                <Input type="password" placeholder="Chave do servidor (AUTHENTICATION_API_KEY)" value={rkey} onChange={(e) => setRkey(e.target.value)} required />
                <Button type="submit" size="sm" disabled={busy === "r"}>{busy === "r" && <Loader2 className="h-4 w-4 animate-spin" />}Testar e trocar</Button>
              </form>
            </Box>

            <Box icon={Bot} title="IA (Argos · Ollama)">
              <p className="flex items-center gap-2"><Dot ok={d.ai.ok} />{d.ai.ok ? `Funcionando · ${(d.ai.ms / 1000).toFixed(1)}s` : d.ai.error}</p>
              <p className="text-muted-foreground">Chave {d.ai.keyMask || "—"}</p>
              <p>Conversas com o Argos este mês: <b>{d.ai.uses}</b></p>
              <p className="text-muted-foreground">O Ollama não informa quanto resta do limite; quando ele acabar, o status acima fica vermelho com "Limite atingido" e é só trocar a chave.</p>
              <form onSubmit={swapAi} className="space-y-2 border-t pt-3">
                <Label>Trocar chave da IA</Label>
                <Input type="password" placeholder="Nova chave do Ollama" value={akey} onChange={(e) => setAkey(e.target.value)} required />
                <Button type="submit" size="sm" disabled={busy === "a"}>{busy === "a" && <Loader2 className="h-4 w-4 animate-spin" />}Testar e trocar</Button>
              </form>
            </Box>
          </div>
        )}
      </div>
    </AppShell>
  );
}
