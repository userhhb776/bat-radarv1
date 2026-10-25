import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronUp, X, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { blocksKey, createBlock, listBlockItems, listBlocks, type LeadBlock } from "@/lib/blocks";
import { useSearchAudit } from "@/hooks/use-search-audit";

export const Route = createFileRoute("/_authenticated/blocos")({
  head: () => ({ meta: [
    { title: "Bloco de leads — BatRadar 5.7" }, { name: "description", content: "Agrupe empresas do mesmo nicho para usar em campanhas." },
    { property: "og:title", content: "Bloco de leads — BatRadar 5.7" }, { property: "og:description", content: "Listas de empresas prontas para campanhas." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: BlocksPage,
});

function BlockRow({ b, query = "" }: { b: LeadBlock; query?: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: items = [], refetch } = useQuery({ queryKey: ["block_items", b.id], queryFn: () => listBlockItems(b.id), enabled: open });
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    if (!q) return items;
    return items.filter((i) => {
      const inName = (i.name ?? "").toLowerCase().includes(q);
      const inPhone = digits.length >= 3 && (i.phone ?? "").replace(/\D/g, "").includes(digits);
      return inName || inPhone;
    });
  }, [items, query]);
  async function removeBlock() {
    if (!confirm(`Excluir o bloco "${b.name}" e suas ${b.count} empresas?`)) return;
    const { error } = await supabase.from("lead_blocks").delete().eq("id", b.id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: blocksKey });
  }
  async function removeItem(id: string) {
    await supabase.from("block_items").delete().eq("id", id);
    refetch(); qc.invalidateQueries({ queryKey: blocksKey });
  }
  return (
    <article className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 p-4">
        <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen(!open)}>
          {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
          <div className="min-w-0"><p className="truncate font-semibold">{b.name}</p>
            <p className="text-xs text-muted-foreground">{b.count} empresa(s){b.niche ? ` · ${b.niche}` : ""}</p></div>
        </button>
        <Button size="icon" variant="ghost" aria-label="Excluir bloco" onClick={removeBlock}><Trash2 className="h-4 w-4" /></Button>
      </div>
      {open && (
        <div className="grid max-h-96 gap-1 overflow-y-auto border-t p-2">
          {shown.length === 0 && items.length > 0 && <p className="p-2 text-sm text-muted-foreground">Nenhuma empresa encontrada nesse bloco para "{query.trim()}".</p>}
          {items.length === 0 && <p className="p-2 text-sm text-muted-foreground">Vazio. Use "Salvar em bloco" na tela Buscar.</p>}
          {shown.map((i) => (
            <div key={i.id} className="flex items-center gap-2 rounded p-2 text-sm hover:bg-muted">
              <span className="min-w-0 flex-1 truncate">{i.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{i.phone ?? "sem telefone"}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Remover" onClick={() => removeItem(i.id)}><X className="h-3 w-3" /></Button>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function BlocksPage() {
  const qc = useQueryClient();
  const { data: blocks = [], isLoading } = useQuery({ queryKey: blocksKey, queryFn: listBlocks });
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  useSearchAudit(query, "/blocos");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return blocks;
    return blocks.filter((b) => (b.name ?? "").toLowerCase().includes(q) || (b.niche ?? "").toLowerCase().includes(q));
  }, [blocks, query]);
  async function add() {
    if (!name.trim()) return;
    try { await createBlock(name.trim()); setName(""); qc.invalidateQueries({ queryKey: blocksKey }); } catch (e) { toast.error(e instanceof Error ? e.message : "Falha"); }
  }
  return (
    <AppShell>
      <p className="text-xs font-semibold uppercase text-primary">Automação</p>
      <h1 className="text-3xl font-bold">Bloco de leads</h1>
      <p className="mt-1 text-sm text-muted-foreground">Junte empresas do mesmo nicho. Na tela Buscar, toque em "Salvar em bloco" para mandar os resultados para cá.</p>
      <div className="mt-6 flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Barbearias — Rio Branco" />
        <Button onClick={add}><Plus className="h-4 w-4" /> Criar bloco</Button>
      </div>
      <div className="mt-4 relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar bloco ou empresa por nome/telefone…"
          className="pl-9"
          aria-label="Buscar em blocos"
        />
      </div>
      <div className="mt-4 grid gap-3">
        {isLoading && <p className="text-muted-foreground">Carregando...</p>}
        {!isLoading && blocks.length === 0 && <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum bloco ainda.</p>}
        {!isLoading && blocks.length > 0 && filtered.length === 0 && <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum bloco encontrado para "{query.trim()}". Abra um bloco para buscar dentro das empresas.</p>}
        {filtered.map((b) => <BlockRow key={b.id} b={b} query={query} />)}
      </div>
    </AppShell>
  );
}
