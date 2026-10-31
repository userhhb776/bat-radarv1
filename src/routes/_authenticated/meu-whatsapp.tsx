import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, Send } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { waList, waSend } from "@/lib/whatsapp.functions";
import { myChats, myMessages } from "@/lib/wa-personal.functions";

export const Route = createFileRoute("/_authenticated/meu-whatsapp")({
  head: () => ({ meta: [
    { title: "Meu WhatsApp — BatRadar" },
    { name: "description", content: "Converse com seus contatos pelo navegador, sem o celular." },
    { property: "og:title", content: "Meu WhatsApp — BatRadar" },
    { property: "og:description", content: "Converse com seus contatos pelo navegador, sem o celular." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});

function Page() {
  const list = useServerFn(waList), chats = useServerFn(myChats), msgs = useServerFn(myMessages), send = useServerFn(waSend);
  const [inst, setInst] = useState(""); const [jid, setJid] = useState(""); const [text, setText] = useState(""); const [q, setQ] = useState(""); const [newNum, setNewNum] = useState("");
  const insts = useQuery({ queryKey: ["wa-insts"], queryFn: () => list() });
  useEffect(() => { if (!inst && insts.data?.length) setInst((insts.data.find((i) => i.status === "open") ?? insts.data[0]!).name); }, [insts.data, inst]);
  const c = useQuery({ queryKey: ["my-chats", inst], queryFn: () => chats({ data: { name: inst } }), enabled: !!inst, refetchInterval: 30000 });
  const m = useQuery({ queryKey: ["my-msgs", inst, jid], queryFn: () => msgs({ data: { name: inst, jid } }), enabled: !!inst && !!jid, refetchInterval: 8000 });
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView(); }, [m.data?.length]);
  const cur = c.data?.find((x) => x.jid === jid);
  async function go() {
    const t = text.trim(); if (!t) return; setText("");
    try { await send({ data: { name: inst, phone: jid.split("@")[0]!, texts: [t] } }); setTimeout(() => m.refetch(), 1500); } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); setText(t); }
  }
  const shown = (c.data ?? []).filter((x) => !q || (x.name + x.jid).toLowerCase().includes(q.toLowerCase()));
  return (
    <AppShell>
      <div className="mx-auto flex h-[calc(100vh-5rem)] max-w-5xl flex-col gap-2 p-2">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Meu WhatsApp</h1>
          <select className="ml-auto rounded-md border bg-background px-2 py-1 text-sm" value={inst} onChange={(e) => { setInst(e.target.value); setJid(""); }}>
            {(insts.data ?? []).map((i) => <option key={i.name} value={i.name}>{i.label}{i.status === "open" ? "" : " (desconectado)"}</option>)}
          </select>
          <Button size="icon" variant="ghost" onClick={() => c.refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
        <p className="text-xs text-muted-foreground">Só você vê. Nenhuma IA responde aqui.</p>
        <div className="flex min-h-0 flex-1 gap-2">
          <div className={`min-h-0 w-full flex-col rounded-lg border md:flex md:w-72 ${jid ? "hidden" : "flex"}`}>
            <Input className="m-2 w-auto" placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="flex gap-1 px-2 pb-2"><Input placeholder="Novo número (DDD+número)" value={newNum} onChange={(e) => setNewNum(e.target.value)} /><Button size="sm" onClick={() => { const d = newNum.replace(/\D/g, ""); if (d.length >= 10) { setJid((d.startsWith("55") ? d : "55" + d) + "@s.whatsapp.net"); setNewNum(""); } }}>Abrir</Button></div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {c.isLoading && <p className="p-3 text-sm text-muted-foreground">Carregando conversas…</p>}
              {c.error && <p className="p-3 text-sm text-destructive">{(c.error as Error).message}</p>}
              {shown.map((x) => (
                <button key={x.jid} onClick={() => setJid(x.jid)} className={`block w-full border-b px-3 py-2 text-left hover:bg-muted ${x.jid === jid ? "bg-muted" : ""}`}>
                  <div className="flex justify-between text-sm font-medium"><span className="truncate">{x.name}</span>{x.unread > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{x.unread}</span>}</div>
                  <div className="truncate text-xs text-muted-foreground">{x.last}</div>
                </button>
              ))}
            </div>
          </div>
          <div className={`min-h-0 flex-1 flex-col rounded-lg border ${jid ? "flex" : "hidden md:flex"}`}>
            {!jid ? <p className="m-auto text-sm text-muted-foreground">Escolha uma conversa</p> : <>
              <div className="flex items-center gap-2 border-b p-2"><Button size="icon" variant="ghost" className="md:hidden" onClick={() => setJid("")}><ArrowLeft className="h-4 w-4" /></Button><span className="font-medium">{cur?.name ?? jid.split("@")[0]}</span></div>
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
                {(m.data ?? []).map((x) => <div key={x.id} className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-1.5 text-sm ${x.me ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}>{x.text}</div>)}
                <div ref={end} />
              </div>
              <form className="flex gap-2 border-t p-2" onSubmit={(e) => { e.preventDefault(); go(); }}>
                <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Mensagem" />
                <Button type="submit" size="icon"><Send className="h-4 w-4" /></Button>
              </form>
            </>}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
