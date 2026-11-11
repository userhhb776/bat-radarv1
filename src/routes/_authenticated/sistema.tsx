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
import { getApifyStatus } from "@/lib/adspy.functions";

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

function AiKeyForm({ provider, name, onDone }: { provider: "groq" | "deepseek" | "gemini" | "ollama"; name: string; onDone: () => void }) {
  const fn = useServerFn(saveAiKey);
  const [k, setK] = useState("");
  const [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await fn({ data: { key: k, provider } }); toast.success(`Chave do ${name} trocada`); setK(""); onDone(); }
    catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={go} className="flex gap-2 border-t pt-2">
      <Input type="password" placeholder={`Nova chave do ${name}`} value={k} onChange={(e) => setK(e.target.value)} required />
      <Button type="submit" size="sm" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Trocar</Button>
    </form>
  );
}

function SistemaPage() {
  const statusFn = useServerFn(getSystemStatus);
  const renderFn = useServerFn(saveRenderServer);
  const q = useQuery({ queryKey: ["system-status"], queryFn: () => statusFn(), staleTime: 60000, retry: false });
  const [url, setUrl] = useState("");
  const [rkey, setRkey] = useState("");
  const [busy, setBusy] = useState<"" | "r">("");
  const [dash, setDash] = useState<DashStyle>("radar");
  const [snd, setSnd] = useState(false);
  useEffect(() => { setDash(getDashStyle()); setSnd(getSound()); }, []);

  async function swapRender(e: React.FormEvent) {
    e.preventDefault(); setBusy("r");
    try { const r = await renderFn({ data: { url, key: rkey } }); toast.success(`Servidor trocado · ${r.connected}/${r.instances} WhatsApps conectados`); setUrl(""); setRkey(""); q.refetch(); }
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

            <div className="lg:col-span-3"><ApifyBox /></div>

            <div className="lg:col-span-3"><Box icon={Bot} title="Inteligências artificiais">
              <p className="text-muted-foreground">Ordem automática: Groq → DeepSeek → Ollama. Prints vão para o Gemini. Se uma falhar, a próxima assume sozinha.</p>
              <div className="grid gap-3 md:grid-cols-2">
                {d.ais.map((a) => (
                  <div key={a.id} className="space-y-2 rounded-lg border p-3">
                    <p className="flex items-center gap-2 font-semibold"><Dot ok={a.ok} />{a.name}<span className="text-xs font-normal text-muted-foreground">· {a.role}</span></p>
                    <p className="text-xs">{a.ok ? `Funcionando · ${(a.ms / 1000).toFixed(1)}s` : a.error}</p>
                    <p className="text-xs text-muted-foreground">Chave {a.keyMask || "—"} · {a.limits}</p>
                    {a.balance && <p>Saldo: <b>{a.balance}</b></p>}
                    {a.rl && (<>
                      <p className="text-xs">Pedidos restantes hoje: <b>{a.rl.reqLeft}</b> de {a.rl.reqLimit}{a.rl.reqReset ? ` · renova em ${a.rl.reqReset}` : ""}</p>
                      <Progress value={Math.min(100, (a.rl.reqLeft / Math.max(1, a.rl.reqLimit)) * 100)} />
                    </>)}
                    <p className="text-xs text-muted-foreground">Usos hoje pelo painel: {a.callsToday}{a.failsToday ? ` (${a.failsToday} falharam)` : ""}</p>
                    <AiKeyForm provider={a.id} name={a.name} onDone={() => q.refetch()} />
                  </div>
                ))}
              </div>
            </Box></div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ApifyBox() {
  const fn = useServerFn(getApifyStatus);
  const q = useQuery({ queryKey: ["apify-status"], queryFn: () => fn(), staleTime: 60000, retry: false });
  const d = q.data;
  return (
    <Box icon={Server} title="Apify · Spy de anúncios">
      {!d ? <p className="text-muted-foreground">Consultando…</p> : !d.ok ? <p className="flex items-center gap-2"><Dot ok={false} />{d.error}</p> : (<>
        <p className="flex items-center gap-2"><Dot ok={d.left > 0.3} />Conta {d.user} · plano {d.plan}</p>
        <p>Saldo do mês: <b>US$ {d.left.toFixed(2)}</b> de US$ {d.max.toFixed(2)} (usado US$ {d.used.toFixed(2)})</p>
        <Progress value={Math.min(100, (d.used / Math.max(0.01, d.max)) * 100)} />
        <p className="text-xs text-muted-foreground">{d.resetAt ? `Renova em ${new Date(d.resetAt).toLocaleDateString("pt-BR")}. ` : ""}Cerca de US$ 0,005 por anúncio minerado. {d.left < 0.5 ? "Hora de trocar a chave ou pagar." : ""}</p>
      </>)}
      <Button size="sm" variant="outline" onClick={() => q.refetch()}><RefreshCw className="h-4 w-4" />Atualizar</Button>
    </Box>
  );
}
