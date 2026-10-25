import { supabase } from "@/integrations/supabase/client";
import type { PlaceLead } from "@/lib/types";

export type LeadBlock = { id: string; name: string; niche: string; created_at: string; count: number };
export type BlockItem = {
  id: string; block_id: string; place_id: string; name: string; phone: string | null; address: string | null;
  website: string | null; rating: number | null; reviews_count: number; niche: string | null; city: string | null; maps_url: string | null;
};

export const blocksKey = ["lead_blocks"] as const;

export async function listBlocks(): Promise<LeadBlock[]> {
  const { data, error } = await supabase.from("lead_blocks").select("id,name,niche,created_at,block_items(count)").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((b) => ({
    id: b.id, name: b.name, niche: b.niche, created_at: b.created_at,
    count: (b.block_items as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));
}

export async function createBlock(name: string, niche = "") {
  const { data, error } = await supabase.from("lead_blocks").insert({ name: name.slice(0, 120), niche: niche.slice(0, 80) }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function listBlockItems(blockId: string): Promise<BlockItem[]> {
  const { data, error } = await supabase.from("block_items").select("*").eq("block_id", blockId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BlockItem[];
}

export async function addToBlock(blockId: string, leads: PlaceLead[], meta: { niche?: string | undefined; city?: string | undefined }) {
  const rows = leads.map((l) => ({
    block_id: blockId, place_id: l.placeId, name: l.name, phone: l.intlPhone ?? l.phone, address: l.address,
    website: l.website, rating: l.rating, reviews_count: l.reviews ?? 0, niche: meta.niche ?? null, city: meta.city ?? null, maps_url: l.mapsUrl,
  }));
  if (!rows.length) return 0;
  await ensureInPipeline(rows);
  const { error } = await supabase.from("block_items").upsert(rows, { onConflict: "block_id,place_id", ignoreDuplicates: true });
  if (error) throw error;
  return rows.length;
}

/** Toda empresa do bloco também fica no Pipeline (sem mexer no status das que já estão lá). Devolve place_id → id do lead. */
export async function ensureInPipeline(rows: Array<{ place_id: string; name: string; phone: string | null; address: string | null; website: string | null; rating: number | null; reviews_count: number | null; niche: string | null; city: string | null; maps_url: string | null }>) {
  if (!rows.length) return new Map<string, string>();
  const lr = rows.map((r) => ({ place_id: r.place_id, name: r.name, phone: r.phone, address: r.address, website: r.website, rating: r.rating, reviews_count: r.reviews_count, niche: r.niche, city: r.city, maps_url: r.maps_url }));
  await supabase.from("leads").upsert(lr as never, { onConflict: "user_id,place_id", ignoreDuplicates: true });
  const { data } = await supabase.from("leads").select("id,place_id").in("place_id", rows.map((r) => r.place_id));
  return new Map((data ?? []).map((d) => [d.place_id, d.id]));
}
