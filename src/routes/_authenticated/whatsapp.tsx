import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, QrCode, Trash2, Send, RefreshCw, X, Pencil, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { waCreate, waList, waQr, waRemove, waSend, waState, type WaInstance } from "@/lib/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp — BatRadar 5.7" },
      { name: "description", content: "Conecte seus números de WhatsApp e dispare abordagens automáticas." },
      { property: "og:title", content: "WhatsApp — BatRadar 5.7" },
      { property: "og:description", content: "Conexão por QR Code e disparo de abordagens em sequência." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WhatsappPage,
});

const statusLabel: Record<string, string> = { open: "Conectado", connecting: "Aguardando leitura", close: "Desconectado" };

function WhatsappPage() {
  const listFn = useServerFn(waList);
  const createFn = useServerFn(waCreate);
  const qrFn = useServerFn(waQr);
  const stateFn = useServerFn(waState);
  const removeFn = useServerFn(waRemove);
  const sendFn = useServerFn(waSend);

  const { data: instances = [], isLoading: loadingInst, refetch, error: instErr } = useQuery({ queryKey: ["wa_instances"], queryFn: () => listFn(), retry: 1 });
  const [label, setLabel] = useState("");
  const { data: labels = {}, refetch: refetchLabels } = useQuery({
    queryKey: ["wa_labels"],
    queryFn: async () => ((await supabase.from("user_settings").select("wa_labels").maybeSingle()).data?.wa_labels ?? {}) as Record<string, string>,
  });
  const [editing, setEditing] = useState<{ name: string; value: string } | null>(null);
  const nameOf = (i: WaInstance) => labels[i.name] || i.label;
  async function saveLabel() {
    if (!editing) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const next = { ...labels, [editing.name]: editing.value.trim().slice(0, 40) };
    const { error } = await supabase.from("user_settings").upsert({ user_id: u.user.id, wa_labels: next }, { onConflict: "user_id" });
    if (error) { toast.error(error.message); return; }
    setEditing(null); refetchLabels(); refetch(); toast.success("Nome atualizado");
  }
  const [qr, setQr] = useState<{ name: string; base64: string | null; code: string | null } | null>(null);

  async function addNumber() {
    try {
      const { name } = await createFn({ data: { label: label || `numero-${instances.length + 1}` } });
      setLabel("");
      await refetch();
      await showQr(name);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao criar conexão"); }
  }
  async function showQr(name: string) {
    try {
      const r = await qrFn({ data: { name } });
      setQr({ name, base64: r.base64, code: r.pairingCode });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao gerar QR Code"); }
  }
  useEffect(() => {
    if (!qr) return;
    const t = setInterval(async () => {
      try {
        const s = await stateFn({ data: { name: qr.name } });
        if (s.state === "open") { setQr(null); toast.success("WhatsApp conectado!"); refetch(); }
      } catch { /* keep polling */ }
    }, 3000);
    const r = setInterval(() => { void showQr(qr.name); }, 40000);
    return () => { clearInterval(t); clearInterval(r); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qr?.name]);

  async function remove(i: WaInstance) {
    if (!confirm(`Desconectar e remover "${nameOf(i)}"?`)) return;
    try { await removeFn({ data: { name: i.name } }); refetch(); } catch (e) { toast.error(e instanceof Error ? e.message : "Falha"); }
  }

  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);
  async function sendTest(i: WaInstance) {
    const phone = testPhone.trim() || i.number || "";
    if (!phone) { toast.error("Digite o número para o teste."); return; }
    setTesting(true);
    try { await sendFn({ data: { name: i.name, phone, texts: ["⚡ Teste BatRadar 5.7: seu WhatsApp está enviando normalmente."] } }); toast.success("Teste enviado! Confira no WhatsApp."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha no teste"); } finally { setTesting(false); }
  }

  return (
    <AppShell>
      <h1 className="text-3xl font-bold">WhatsApp</h1>
      <p className="mt-1 text-muted-foreground">Conecte seus números. Os envios são feitos pelas Campanhas. A primeira abertura do dia pode levar até 1 minuto (o servidor acorda).</p>

      <section className="mt-6 rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Números conectados</h2>
          <Button size="icon" variant="ghost" aria-label="Atualizar" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
        {loadingInst && <p className="mt-2 text-sm text-muted-foreground">Acordando o servidor…</p>}
        {instErr && <p className="mt-2 text-sm text-destructive">{instErr instanceof Error ? instErr.message : "Falha ao falar com o servidor"}</p>}
        <div className="mt-3 grid gap-2">
          {instances.map((i) => (
            <div key={i.name} className="flex flex-wrap items-center gap-2 rounded-md border p-3">
              <div className="min-w-0 flex-1">
                {editing?.name === i.name ? (
                  <div className="flex gap-1">
                    <Input value={editing.value} autoFocus onChange={(e) => setEditing({ name: i.name, value: e.target.value })} onKeyDown={(e) => e.key === "Enter" && saveLabel()} className="h-8" />
                    <Button size="icon" variant="ghost" aria-label="Salvar nome" onClick={saveLabel}><Check className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <p className="flex items-center gap-1 font-medium">{nameOf(i)}{i.profile ? ` · ${i.profile}` : ""}
                    <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Editar nome" onClick={() => setEditing({ name: i.name, value: nameOf(i) })}><Pencil className="h-3 w-3" /></Button>
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{i.number ? `+${i.number} · ` : ""}{statusLabel[i.status] ?? i.status}</p>
              </div>
              {i.status !== "open" && <Button size="sm" variant="outline" onClick={() => showQr(i.name)}><QrCode className="mr-1 h-4 w-4" /> QR Code</Button>}
              <Button size="sm" variant="ghost" aria-label="Remover" onClick={() => remove(i)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Input placeholder="Nome do número (ex: principal)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Button onClick={addNumber}><Plus className="mr-1 h-4 w-4" /> Conectar</Button>
        </div>
        {qr && (
          <div className="mt-4 grid justify-items-center gap-2 rounded-md border border-accent/40 p-4 text-center">
            <div className="flex w-full justify-end"><Button size="icon" variant="ghost" aria-label="Fechar" onClick={() => setQr(null)}><X className="h-4 w-4" /></Button></div>
            {qr.base64 ? <img src={qr.base64} alt="QR Code do WhatsApp" className="h-64 w-64 rounded bg-card" /> : <p className="text-sm">Gerando QR Code…</p>}
            <p className="text-sm text-muted-foreground">No WhatsApp: Configurações → Aparelhos conectados → Conectar aparelho, e aponte para o código.</p>
            {qr.code && <p className="text-sm">Ou use o código: <b className="font-mono">{qr.code}</b></p>}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-lg border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">Mensagem de teste</h2>
        <p className="mt-1 text-sm text-muted-foreground">Envia um "oi" de teste. Deixe vazio para mandar para o próprio número conectado.</p>
        <Input className="mt-3" placeholder="Número com DDD (opcional)" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
        <div className="mt-2 flex flex-wrap gap-2">
          {instances.filter((i) => i.status === "open").map((i) => (
            <Button key={i.name} variant="outline" disabled={testing} onClick={() => sendTest(i)}><Send className="mr-1 h-4 w-4" /> Testar com {nameOf(i)}</Button>
          ))}
          {!instances.some((i) => i.status === "open") && <p className="text-sm text-muted-foreground">Conecte um número primeiro.</p>}
        </div>
      </section>
    </AppShell>
  );
}
