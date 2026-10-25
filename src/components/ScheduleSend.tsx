import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { fillScript, listScripts, scriptMessages, scriptsKey } from "@/lib/scripts";
import { waList } from "@/lib/whatsapp.functions";

type Target = { name: string; phone: string | null; city?: string | null; niche?: string | null; rating?: number | null; reviews?: number | null; website?: string | null; leadId?: string | null };

export function localIn(min: number) {
  const d = new Date(Date.now() + min * 60000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function ScheduleSend({ target }: { target: Target }) {
  const qc = useQueryClient();
  const listFn = useServerFn(waList);
  const [open, setOpen] = useState(false);
  const { data: scripts = [] } = useQuery({ queryKey: scriptsKey, queryFn: listScripts, enabled: open });
  const { data: instances = [] } = useQuery({ queryKey: ["wa_instances"], queryFn: () => listFn(), enabled: open, retry: 1 });
  const connected = instances.filter((i) => i.status === "open");
  const [scriptId, setScriptId] = useState("");
  const [instance, setInstance] = useState("");
  const [at, setAt] = useState("");
  const [gap, setGap] = useState(30);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open && !at) setAt(localIn(10)); }, [open, at]);
  useEffect(() => { if (!instance && connected[0]) setInstance(connected[0].name); }, [connected, instance]);
  const script = scripts.find((s) => s.id === scriptId);
  const msgs = script ? scriptMessages(script).map((m) => fillScript(m, target)) : [];

  async function save() {
    if (!target.phone) { toast.error("Empresa sem telefone."); return; }
    if (!script || !instance || !at) { toast.error("Escolha script, número e horário."); return; }
    setBusy(true);
    try {
      const t0 = new Date(at).getTime();
      const rows = msgs.map((m, i) => ({ instance, lead_id: target.leadId ?? null, name: target.name, phone: target.phone!, texts: [m], send_at: new Date(t0 + i * gap * 1000).toISOString() }));
      const { error } = await supabase.from("wa_scheduled").insert(rows);
      if (error) throw error;
      toast.success(`${rows.length} mensagem(ns) agendada(s) — veja em Agendamentos`);
      qc.invalidateQueries({ queryKey: ["wa_scheduled"] });
      setOpen(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao agendar"); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" disabled={!target.phone}><CalendarClock className="h-4 w-4" /> Agendar envio</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Agendar para {target.name}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Script (funil)</Label>
            <Select value={scriptId} onValueChange={setScriptId}><SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
              <SelectContent>{scripts.map((s) => <SelectItem key={s.id} value={s.id}>{s.title} · {scriptMessages(s).length} msg</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Enviar pelo número</Label>
            <Select value={instance} onValueChange={setInstance}><SelectTrigger><SelectValue placeholder="Nenhum conectado" /></SelectTrigger>
              <SelectContent>{connected.map((i) => <SelectItem key={i.name} value={i.name}>{i.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Dia e horário</Label><Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></div>
            <div><Label>Entre mensagens (s)</Label><Input type="number" min={0} value={gap} onChange={(e) => setGap(Number(e.target.value))} /></div>
          </div>
          {msgs.length > 0 && <div className="rounded-md bg-muted p-3 text-sm">{msgs.map((m, i) => <p key={i} className="mb-1 whitespace-pre-wrap break-words"><b>{i + 1}.</b> {m}</p>)}</div>}
          <Button disabled={busy} onClick={save}>Agendar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
