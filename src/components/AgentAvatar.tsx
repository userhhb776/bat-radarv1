import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setAgentAvatar } from "@/lib/agent-squad.functions";

async function shrink(file: File, size = 320): Promise<string> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
  const c = document.createElement("canvas"); c.width = size; c.height = size;
  const s = Math.min(img.width, img.height);
  c.getContext("2d")!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  URL.revokeObjectURL(url);
  return c.toDataURL("image/jpeg", 0.85);
}

/** Foto do agente; com `editable`, tocar abre a escolha de uma nova imagem. */
export function AgentAvatar({ id, name, url, className = "h-10 w-10", editable = false }: { id?: string; name: string; url?: string | null; className?: string; editable?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const save = useServerFn(setAgentAvatar);
  const qc = useQueryClient();
  const pick = async (f?: File) => {
    if (!f || !id) return;
    setBusy(true);
    try { await save({ data: { id, avatar_url: await shrink(f) } }); qc.invalidateQueries(); toast.success("Foto atualizada"); }
    catch (e: any) { toast.error(e.message ?? "Não deu para trocar a foto"); }
    finally { setBusy(false); }
  };
  return (
    <div className={`group relative shrink-0 overflow-hidden rounded-full border border-primary/30 bg-primary/10 ${className}`}>
      {url ? <img src={url} alt={name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center font-bold">{name.slice(0, 2).toUpperCase()}</div>}
      {editable && id && <>
        <button type="button" aria-label="Trocar foto" onClick={() => ref.current?.click()} className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition group-hover:opacity-100 focus:opacity-100">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        </button>
        <span className="pointer-events-none absolute bottom-0 right-0 rounded-full bg-primary p-1 text-primary-foreground"><Camera className="h-2.5 w-2.5" /></span>
        <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </>}
    </div>
  );
}
