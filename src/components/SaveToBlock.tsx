import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { addToBlock, blocksKey, createBlock, listBlocks } from "@/lib/blocks";
import type { PlaceLead } from "@/lib/types";

export function SaveToBlock({ leads, niche, city }: { leads: PlaceLead[]; niche?: string | undefined; city?: string | undefined }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: blocks = [] } = useQuery({ queryKey: blocksKey, queryFn: listBlocks, enabled: open });
  const withPhone = leads.filter((l) => l.phone || l.intlPhone);

  async function save(blockId?: string) {
    setBusy(true);
    try {
      const id = blockId ?? await createBlock(name.trim() || `${niche ?? "Leads"}${city ? ` — ${city}` : ""}`, niche ?? "");
      const n = await addToBlock(id, withPhone, { niche, city });
      toast.success(`${n} empresa(s) salvas no bloco`);
      qc.invalidateQueries({ queryKey: blocksKey });
      setOpen(false); setName("");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao salvar"); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size={leads.length === 1 ? "default" : "sm"} variant="outline" className="max-sm:w-full" disabled={withPhone.length === 0}>
          <Layers className="h-4 w-4" /> {leads.length === 1 ? "Mover para bloco" : `Salvar em bloco (${withPhone.length})`}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Salvar {withPhone.length} empresa(s) com telefone</DialogTitle></DialogHeader>
        <div className="grid gap-2">
          {blocks.map((b) => (
            <Button key={b.id} variant="outline" className="justify-between" disabled={busy} onClick={() => save(b.id)}>
              <span className="truncate">{b.name}</span><span className="text-xs text-muted-foreground">{b.count}</span>
            </Button>
          ))}
          <div className="mt-2 flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`Novo bloco: ${niche ?? "Barbearias"}${city ? ` — ${city}` : ""}`} />
            <Button disabled={busy} onClick={() => save()}>Criar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
