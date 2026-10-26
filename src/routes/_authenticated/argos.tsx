import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Eye, Loader2, Send, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { argosChat } from "@/lib/argos.functions";

export const Route = createFileRoute("/_authenticated/argos")({
  head: () => ({ meta: [
    { title: "Argos — IA do painel | BatRadar" }, { name: "description", content: "Converse com Argos, a IA que executa ações no BatRadar por você." },
    { property: "og:title", content: "Argos — IA do BatRadar" }, { property: "og:description", content: "Assistente com controle do painel: busca leads, cria blocos e campanhas." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});

type M = { role: "user" | "assistant"; content: string; actions?: string[] };
const KEY = "argos-chat";

function Page() {
  const chat = useServerFn(argosChat);
  const [msgs, setMsgs] = useState<M[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { try { setMsgs(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch { /* vazio */ } }, []);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(msgs.slice(-60))); end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function send() {
    const t = text.trim(); if (!t || busy) return;
    const next = [...msgs, { role: "user" as const, content: t }];
    setMsgs(next); setText(""); setBusy(true);
    try {
      const r = await chat({ data: { messages: next.slice(-20).map(({ role, content }) => ({ role, content })) } });
      setMsgs((m) => [...m, { role: "assistant", content: r.reply, actions: r.actions }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: "⚠ " + (e instanceof Error ? e.message : "Falha.") }]);
    } finally { setBusy(false); input.current?.focus(); }
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-full border border-primary/50 bg-primary/10 text-primary"><Eye className="h-5 w-5" /></div>
          <div><h1 className="text-2xl font-bold">Argos</h1><p className="text-xs text-muted-foreground">Sua IA com controle do painel</p></div>
        </div>
        {msgs.length > 0 && <Button size="sm" variant="ghost" onClick={() => setMsgs([])}><Trash2 className="h-4 w-4" /> Nova conversa</Button>}
      </div>
      <div className="mt-4 flex min-h-[50vh] flex-col gap-3 rounded-lg border p-3">
        {!msgs.length && <p className="m-auto max-w-sm text-center text-sm text-muted-foreground">Às suas ordens, senhor. Ex.: “busque 15 barbearias sem site em Rio Branco e salve num bloco” ou “como estão as campanhas?”.</p>}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "ml-auto max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground" : "max-w-[90%] text-sm"}>
            <p className="whitespace-pre-wrap">{m.content}</p>
            {m.actions?.length ? <p className="mt-1 text-[11px] text-muted-foreground">Executou: {m.actions.join(", ")}</p> : null}
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Argos está trabalhando…</div>}
        <div ref={end} />
      </div>
      <div className="mt-3 flex items-end gap-2">
        <Textarea ref={input} autoFocus rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Peça algo ao Argos…"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <Button size="icon" className="h-11 w-11 shrink-0" onClick={send} disabled={busy || !text.trim()}><Send className="h-4 w-4" /></Button>
      </div>
    </AppShell>
  );
}
