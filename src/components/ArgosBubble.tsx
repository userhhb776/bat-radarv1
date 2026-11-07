import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState } from "@tanstack/react-router";
import { Eye, Loader2, Send, X } from "lucide-react";
import { argosChat } from "@/lib/argos.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type M = { role: "user" | "assistant"; content: string; actions?: string[] };
const KEY = "argos-chat";

/** Bolinha flutuante do Argos, presente em todas as telas do painel. */
export function ArgosBubble() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const chat = useServerFn(argosChat);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<M[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) try { setMsgs(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch { /* vazio */ } }, [open]);
  useEffect(() => { if (open) { localStorage.setItem(KEY, JSON.stringify(msgs.slice(-60))); end.current?.scrollIntoView(); } }, [msgs, open]);
  if (path === "/argos") return null;

  async function send() {
    const t = text.trim(); if (!t || busy) return;
    const next = [...msgs, { role: "user" as const, content: `${t}\n(tela atual: ${path})` }];
    setMsgs(next); setText(""); setBusy(true);
    try {
      const r = await chat({ data: { messages: next.slice(-20).map(({ role, content }) => ({ role, content })) } });
      setMsgs((m) => [...m, { role: "assistant", content: r.reply, actions: r.actions }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: "⚠ " + (e instanceof Error ? e.message : "Falha.") }]);
    } finally { setBusy(false); }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-4 z-50 flex h-[70vh] max-h-[520px] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div className="flex items-center gap-2 font-semibold"><Eye className="h-4 w-4 text-primary" /> Argos</div>
            <div className="flex items-center gap-1">
              {msgs.length > 0 && <Button size="sm" variant="ghost" onClick={() => setMsgs([])}>Limpar</Button>}
              <Button size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="Fechar"><X className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3 text-sm">
            {!msgs.length && <p className="m-auto text-center text-muted-foreground">Às ordens, senhor. Peça análises ou comandos do painel.</p>}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "ml-auto max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-primary-foreground" : "max-w-[90%]"}>
                <p className="whitespace-pre-wrap">{m.role === "user" ? m.content.replace(/\n\(tela atual: .*\)$/, "") : m.content}</p>
                {m.actions?.length ? <p className="mt-1 text-[11px] text-muted-foreground">Executou: {m.actions.join(", ")}</p> : null}
              </div>
            ))}
            {busy && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> trabalhando…</div>}
            <div ref={end} />
          </div>
          <div className="flex items-end gap-2 border-t p-2">
            <Textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Peça algo ao Argos…"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <Button size="icon" onClick={send} disabled={busy || !text.trim()}><Send className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} aria-label="Abrir Argos"
        className="fixed bottom-4 right-4 z-50 grid h-14 w-14 place-items-center rounded-full border-2 border-primary bg-card text-primary shadow-xl transition hover:scale-105">
        {open ? <X className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
      </button>
    </>
  );
}
