import { supabase } from "@/integrations/supabase/client";
import type { Audit, LeadStatus, PlaceLead } from "./types";

export type SavedLead = {
  id: string;
  place_id: string;
  name: string;
  phone: string | null;
  address: string | null;
  website: string | null;
  rating: number | null;
  reviews_count: number | null;
  niche: string | null;
  city: string | null;
  maps_url: string | null;
  status: LeadStatus;
  audit: Audit | null;
  message: string | null;
  notes: string | null;
  updated_at: string;
  delivered_site_url: string | null;
  delivered_at: string | null;
  script_id: string | null;
  next_followup_at: string | null;
  last_contact_at: string | null;
  source: string;
  source_url: string | null;
  instagram: string | null;
  tags: string[];
};

export const leadsKey = ["leads"] as const;

export async function listLeads(): Promise<SavedLead[]> {
  const { data, error } = await supabase.from("leads").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as SavedLead[];
}

export async function saveLead(
  p: PlaceLead,
  extra: { niche?: string | undefined; city?: string | undefined; audit?: Audit | null | undefined; message?: string | null | undefined } = {},
): Promise<SavedLead> {
  const row: Record<string, unknown> = {
    place_id: p.placeId,
    name: p.name,
    phone: p.intlPhone ?? p.phone,
    address: p.address,
    website: p.website,
    rating: p.rating,
    reviews_count: p.reviews,
    maps_url: p.mapsUrl,
    niche: extra.niche ?? null,
    city: extra.city ?? null,
  };
  if (extra.audit !== undefined) row["audit"] = extra.audit;
  if (extra.message !== undefined) row["message"] = extra.message;
  const { data, error } = await supabase
    .from("leads")
    .upsert(row as never, { onConflict: "user_id,place_id" })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as SavedLead;
}

export async function updateLead(id: string, patch: Partial<Pick<SavedLead, "phone" | "status" | "audit" | "message" | "notes" | "delivered_site_url" | "delivered_at" | "script_id" | "next_followup_at" | "last_contact_at">>) {
  const { error } = await supabase.from("leads").update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function deleteLead(id: string) {
  const { data: l } = await supabase.from("leads").select("place_id,name,niche,rating,reviews_count,website,address,source").eq("id", id).maybeSingle();
  if (l && l.source !== "externo") await recordDiscard(l);
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw error;
}

/** Guarda o perfil da empresa descartada para o robô de Leads do dia aprender o que evitar. */
export async function recordDiscard(c: { place_id: string; name: string; niche: string | null; rating: number | null; reviews_count: number | null; website: string | null; address: string | null }) {
  await supabase.from("mining_feedback").upsert(
    { place_id: c.place_id, kind: "descartado", name: c.name, niche: c.niche, rating: c.rating, reviews_count: c.reviews_count ?? 0, website: c.website, address: c.address } as never,
    { onConflict: "user_id,place_id,kind", ignoreDuplicates: true },
  );
}

export function toPlaceLead(l: SavedLead): PlaceLead {
  return {
    placeId: l.place_id,
    name: l.name,
    phone: l.phone,
    intlPhone: l.phone,
    address: l.address,
    website: l.website,
    rating: l.rating,
    reviews: l.reviews_count ?? 0,
    mapsUrl: l.maps_url,
  };
}

export type ExternalLeadInput = {
  name: string; source_url: string; phone?: string | null; instagram?: string | null; maps_url?: string | null;
};

export async function addExternalLeads(items: ExternalLeadInput[]) {
  const rows = items.map((i) => ({
    place_id: `ext-${crypto.randomUUID()}`, name: i.name, phone: i.phone || null,
    instagram: i.instagram || null, maps_url: i.maps_url || null,
    source_url: i.source_url, source: "externo",
  }));
  const { error } = await supabase.from("leads").insert(rows as never);
  if (error) throw error;
}
