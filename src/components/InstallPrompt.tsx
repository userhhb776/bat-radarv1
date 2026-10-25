import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, Download } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { enablePush, pushMessages } from "@/lib/push-client";

const KEY = "batradar-onboarding-v1";
type BIP = Event & { prompt: () => Promise<void> };

/** Aparece uma única vez: instalar o app e permitir notificações. */
export function InstallPrompt() {
  const [open, setOpen] = useState(false);
  const [bip, setBip] = useState<BIP | null>(null);
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    if (window.top !== window.self || localStorage.getItem(KEY)) return;
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setStandalone(window.matchMedia("(display-mode: standalone)").matches);
    const h = (e: Event) => { e.preventDefault(); setBip(e as BIP); };
    window.addEventListener("beforeinstallprompt", h);
    const t = setTimeout(() => setOpen(true), 1500);
    return () => { window.removeEventListener("beforeinstallprompt", h); clearTimeout(t); };
  }, []);

  function close() {
    localStorage.setItem(KEY, "1");
    setOpen(false);
  }

  async function notify() {
    const r = await enablePush();
    (r === "registered" ? toast.success : toast.error)(pushMessages[r]);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>Leve o BatRadar com você</DialogTitle>
          <DialogDescription>Instale o app e ative os avisos: você recebe uma notificação quando os leads do dia chegarem e um lembrete se ficar 8h sem prospectar.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {!standalone && bip && (
            <Button onClick={async () => { await bip.prompt(); setBip(null); }}><Download className="mr-2 h-4 w-4" /> Instalar o app</Button>
          )}
          {!standalone && !bip && ios && (
            <p className="rounded-md border p-3 text-sm text-muted-foreground">No iPhone: toque em <b>Compartilhar</b> → <b>Adicionar à Tela de Início</b>. Depois abra pelo ícone para ativar as notificações.</p>
          )}
          <Button variant={bip ? "outline" : "default"} onClick={notify}><Bell className="mr-2 h-4 w-4" /> Ativar notificações</Button>
          <Button variant="ghost" onClick={close}>Agora não</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
