import { supabase } from "@/integrations/supabase/client";

export type Script = {
  id: string;
  title: string;
  niche: string;
  stage: string;
  site_filter: string;
  body: string;
  message2: string;
  message3: string;
  variants?: string[][] | null;
  updated_at: string;
};

export const SCRIPT_STAGES = [
  { id: "primeiro_contato", label: "Primeiro contato" },
  { id: "followup", label: "Follow-up" },
  { id: "reuniao", label: "Convite p/ reunião" },
  { id: "proposta", label: "Envio de proposta" },
  { id: "reativacao", label: "Reativação" },
] as const;

export const SITE_FILTERS = [
  { id: "todos", label: "Qualquer empresa" },
  { id: "sem_site", label: "Só sem site" },
  { id: "com_site", label: "Só com site" },
] as const;

export const VARIABLES = ["{nome}", "{cidade}", "{nicho}", "{nota}", "{avaliacoes}", "{site}"];

export const scriptsKey = ["scripts"] as const;

export async function listScripts(): Promise<Script[]> {
  const { data, error } = await supabase.from("scripts").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Script[];
}

export async function saveScript(s: Partial<Script> & Pick<Script, "title" | "body">) {
  const variants = [0, 1, 2].map((k) => (s.variants?.[k] ?? []).map((v) => v.trim()).filter(Boolean).map((v) => v.slice(0, 2000)));
  const row = { title: s.title, body: s.body, message2: s.message2 ?? "", message3: s.message3 ?? "", niche: s.niche ?? "", stage: s.stage ?? "primeiro_contato", site_filter: s.site_filter ?? "todos", variants };
  const q = s.id ? supabase.from("scripts").update(row).eq("id", s.id) : supabase.from("scripts").insert(row);
  const { error } = await q;
  if (error) throw error;
}

export async function deleteScript(id: string) {
  const { error } = await supabase.from("scripts").delete().eq("id", id);
  if (error) throw error;
}

export function fillScript(body: string, l: { name: string; city?: string | null; niche?: string | null; rating?: number | null; reviews?: number | null; website?: string | null }) {
  return body
    .replaceAll("{nome}", l.name)
    .replaceAll("{cidade}", l.city || "sua cidade")
    .replaceAll("{nicho}", l.niche || "seu segmento")
    .replaceAll("{nota}", l.rating != null ? l.rating.toFixed(1).replace(".", ",") : "—")
    .replaceAll("{avaliacoes}", String(l.reviews ?? 0))
    .replaceAll("{site}", l.website ? "seu site atual" : "um site próprio");
}

export function scriptMatches(s: Script, l: { niche?: string | null; website?: string | null }) {
  if (s.site_filter === "sem_site" && l.website) return false;
  if (s.site_filter === "com_site" && !l.website) return false;
  if (s.niche && l.niche && !l.niche.toLowerCase().includes(s.niche.toLowerCase()) && !s.niche.toLowerCase().includes(l.niche.toLowerCase())) return false;
  return true;
}

/** Mensagens principais (sem variações), na ordem do funil. */
export function scriptMessages(s: Pick<Script, "body" | "message2" | "message3">) {
  return [s.body, s.message2, s.message3].map((x) => (x ?? "").trim()).filter(Boolean);
}

/** Para cada mensagem do funil: o texto principal + as variações. */
export function scriptSlots(s: Pick<Script, "body" | "message2" | "message3" | "variants">) {
  return [s.body, s.message2, s.message3]
    .map((x, i) => ({ main: (x ?? "").trim(), vars: (s.variants?.[i] ?? []).map((v) => v.trim()).filter(Boolean) }))
    .filter((x) => x.main)
    .map((x) => [x.main, ...x.vars]);
}

function shuffle<T>(a: T[]) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j]!, b[i]!]; } return b; }

/** Distribui as variações de forma equilibrada: n empresas → n funis (cada um com uma versão de cada mensagem). */
export function distributeVariants(s: Pick<Script, "body" | "message2" | "message3" | "variants">, n: number): string[][] {
  const slots = scriptSlots(s);
  const decks = slots.map((opts) => { let deck: string[] = []; return () => { if (!deck.length) deck = shuffle(opts); return deck.pop()!; }; });
  return Array.from({ length: n }, () => decks.map((d) => d()));
}
