import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Search, UserRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { waContacts, waContactPhoto, type WaInstance } from "@/lib/whatsapp.functions";
import { contactMatches, type WaContact } from "@/lib/wa-contacts";

export function WaContactPhoto({ instance, label }: { instance: WaInstance; label: string }) {
  const contactsFn = useServerFn(waContacts);
  const photoFn = useServerFn(waContactPhoto);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<WaContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [photo, setPhoto] = useState<{ image: string | null; number: string; name: string } | null>(null);

  async function show() {
    setOpen(true); setQuery(""); setPhoto(null); setError(""); setListError(""); setLoading(true);
    try { setContacts(await contactsFn({ data: { name: instance.name } })); }
    catch { setListError("Não foi possível carregar os nomes. A consulta por número continua disponível."); }
    finally { setLoading(false); }
  }

  async function lookup(contact: WaContact) {
    setBusy(true); setPhoto(null); setError("");
    try { setPhoto({ ...await photoFn({ data: { name: instance.name, phone: contact.number } }), name: contact.name }); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível consultar a foto."); }
    finally { setBusy(false); }
  }

  function download() {
    if (!photo?.image) return;
    const link = document.createElement("a");
    link.href = photo.image;
    const extension = photo.image.startsWith("data:image/png") ? "png" : photo.image.startsWith("data:image/webp") ? "webp" : "jpg";
    link.download = `foto-${photo.number}.${extension}`;
    document.body.appendChild(link); link.click(); link.remove();
  }

  const ownContact = instance.number ? { number: instance.number, name: instance.profile || "Meu perfil" } : null;
  const items = [...(ownContact ? [ownContact] : []), ...contacts.filter((c) => c.number !== ownContact?.number)];
  const matches = items.filter((c) => !query.trim() || contactMatches(c, query)).slice(0, 30);
  const digits = query.replace(/\D/g, "");
  const isPhone = /^[+\d\s().-]+$/.test(query.trim()) && digits.length >= 8;

  return <>
    <Button size="sm" variant="outline" disabled={instance.status !== "open"} onClick={show}><UserRound className="mr-1 h-4 w-4" /> Fotos de contatos</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto">
        <DialogTitle>Fotos de contatos · {label}</DialogTitle>
        <DialogDescription>Nome ou número com código do país e DDD</DialogDescription>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (isPhone && !busy) void lookup({ name: query, number: digits }); }}>
          <Input aria-label="Nome ou número do contato" placeholder="Nome ou +55 11 99999-9999" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Button size="icon" type="submit" aria-label="Consultar número" disabled={!isPhone || busy}><Search className="h-4 w-4" /></Button>
        </form>
        {loading && <p className="text-sm text-muted-foreground">Carregando contatos…</p>}
        {listError && <p className="text-sm text-muted-foreground">{listError}</p>}
        <div className="max-h-52 space-y-1 overflow-y-auto">
          {matches.map((c) => <Button key={c.number} className="h-auto w-full justify-start gap-2 py-2 text-left" variant="ghost" disabled={busy} onClick={() => lookup(c)}>
            <UserRound className="h-4 w-4 shrink-0" /><span className="min-w-0"><span className="block truncate">{c.name}{c.number === ownContact?.number ? " · Meu perfil" : ""}</span><span className="block text-xs text-muted-foreground">+{c.number}</span></span>
          </Button>)}
          {!loading && matches.length === 0 && <p className="text-sm text-muted-foreground">Nenhum contato encontrado.</p>}
        </div>
        {busy && <Loader2 aria-label="Consultando foto" className="mx-auto h-6 w-6 animate-spin" />}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {photo && <div className="grid justify-items-center gap-3">
          <p className="max-w-full break-words text-center font-medium">{photo.name}</p>
          {photo.image ? <><img src={photo.image} alt={`Foto de ${photo.name}`} className="aspect-square w-full max-w-72 rounded-md object-contain" /><Button onClick={download}><Download className="mr-2 h-4 w-4" /> Baixar foto</Button></> : <p className="text-center text-sm text-muted-foreground">Foto indisponível para este número. Pode não existir ou estar restrita pela privacidade do WhatsApp.</p>}
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}