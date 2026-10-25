import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { NICHES, NICHE_GROUPS, isSocialLink } from "@/lib/niches";
import { CITIES } from "@/lib/mining-options";
import { isMobileBR, normalizeBR } from "@/lib/phone";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";
export const DAILY = 15;
const MAX_SEARCHES = 20;

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]!;

export type Cand = { place_id: string; name: string; phone: string | null; address: string | null; website: string | null; rating: number | null; reviews_count: number; niche: string; city: string; maps_url: string | null };

async function search(niche: string, city: string, pageToken?: string): Promise<{ list: Cand[]; next: string | null }> {
  const res = await fetch(`${GATEWAY_URL}/places/v1/places:searchText`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
      "X-Connection-Api-Key": process.env["GOOGLE_MAPS_API_KEY"]!,
      "Content-Type": "application/json",
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri,places.businessStatus,nextPageToken",
    },
    body: JSON.stringify({ textQuery: `${niche} em ${city}`, pageSize: 20, languageCode: "pt-BR", regionCode: "BR", ...(pageToken ? { pageToken } : {}) }),
  });
  if (!res.ok) {
    const err = new Error(`Google Maps ${res.status}: ${await res.text()}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  const json = (await res.json()) as { places?: Array<Record<string, any>>; nextPageToken?: string };
  const list = (json.places ?? [])
    .filter((p) => p["businessStatus"] !== "CLOSED_PERMANENTLY")
    .filter((p) => !p["websiteUri"] || isSocialLink(p["websiteUri"]))
    // só celulares (WhatsApp); fixos geram falha no envio
    .filter((p) => isMobileBR(p["internationalPhoneNumber"] ?? p["nationalPhoneNumber"]))
    .map((p) => ({
      place_id: p["id"],
      name: p["displayName"]?.text ?? "Sem nome",
      phone: normalizeBR(p["internationalPhoneNumber"] ?? p["nationalPhoneNumber"]),
      address: p["formattedAddress"] ?? null,
      website: p["websiteUri"] ?? null,
      rating: typeof p["rating"] === "number" ? p["rating"] : null,
      reviews_count: typeof p["userRatingCount"] === "number" ? p["userRatingCount"] : 0,
      niche,
      city,
      maps_url: p["googleMapsUri"] ?? null,
    }));
  return { list, next: json.nextPageToken ?? null };
}

type Prof = { minRating: number; minReviews: number; maxReviews: number; medRating: number; medReviews: number; socialShare: number };
const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))]! : 0; };

/** Perfil das empresas que o usuário escolheu (pipeline, priorizando as que avançaram). */
function profileOf(rows: Array<{ rating: number | null; reviews_count: number | null; website: string | null; status: string; source: string }>): Prof {
  const own = rows.filter((r) => r.source !== "externo" && r.status !== "perdido");
  const adv = own.filter((r) => r.status !== "novo");
  const base = (adv.length >= 5 ? adv : own).filter((r) => r.rating != null);
  if (base.length < 5) return { minRating: 4.2, minReviews: 30, maxReviews: 2000, medRating: 4.6, medReviews: 120, socialShare: 0.6 };
  const rt = base.map((r) => r.rating!), rv = base.map((r) => r.reviews_count ?? 0);
  return {
    minRating: Math.max(4.0, q(rt, 0.15)),
    minReviews: Math.max(20, q(rv, 0.15)),
    maxReviews: Math.max(300, q(rv, 0.95) * 1.5),
    medRating: q(rt, 0.5),
    medReviews: Math.max(30, q(rv, 0.5)),
    socialShare: base.filter((r) => isSocialLink(r.website)).length / base.length,
  };
}

function qualifies(c: Cand, p: Prof) {
  if (c.rating == null || c.rating < p.minRating) return false;
  if (c.reviews_count < p.minReviews || c.reviews_count > p.maxReviews) return false;
  // evita interior/região metropolitana: endereço precisa citar a cidade buscada
  const city = c.city.split(",")[0]!.toLowerCase();
  if (c.address && !c.address.toLowerCase().includes(city)) return false;
  return true;
}

function similarity(c: Cand, p: Prof) {
  const r = 1 - Math.min(1, Math.abs((c.rating ?? 0) - p.medRating) / 1);
  const v = 1 - Math.min(1, Math.abs(Math.log10(c.reviews_count + 1) - Math.log10(p.medReviews + 1)));
  const social = isSocialLink(c.website) ? p.socialShare : 1 - p.socialShare;
  return r * 0.35 + v * 0.4 + social * 0.25;
}

import { buildModel, learned } from "@/lib/mining-model";

export const todayRioBranco = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);

/** Garimpa até 15 empresas novas para um usuário, respeitando os filtros opcionais de nicho/estado. */
export async function mineForUser(
  db: SupabaseClient<Database>,
  userId: string,
  opts: { niche?: string | null | undefined; state?: string | null | undefined; replaceToday?: boolean },
) {
  const [{ data: l }, { data: d }, { data: fb }] = await Promise.all([
    db.from("leads").select("place_id,name,niche,address,rating,reviews_count,website,status,source,last_contact_at").eq("user_id", userId),
    db.from("daily_leads").select("place_id").eq("user_id", userId),
    db.from("mining_feedback").select("place_id,kind,name,niche,address,rating,reviews_count,website").eq("user_id", userId),
  ]);
  const seen = new Set([...(l ?? []), ...(d ?? []), ...(fb ?? [])].map((r) => r.place_id));
  const model = buildModel((l ?? []) as never, (fb ?? []).filter((x) => x.kind === "descartado") as never);
  const niches = opts.niche ? NICHE_GROUPS[opts.niche] ?? [opts.niche] : NICHES;
  const cities = opts.state ? CITIES.filter((c) => c.endsWith(`, ${opts.state}`)) : CITIES;
  const pool = cities.length ? cities : CITIES;

  const prof = profileOf(l ?? []);
  const chosen: Cand[] = [];
  const backup: Array<{ c: Cand; s: number }> = [];
  const per = niches.length === 1 && pool.length <= 3 ? 8 : 3;
  const tried = new Set<string>();
  const combos = () => {
    const out: Array<[string, string]> = [];
    for (let k = 0; k < 30 && out.length < 5; k++) {
      const n = pick(niches), c = pick(pool), key = `${n}|${c}`;
      if (tried.has(key)) continue;
      tried.add(key); out.push([n, c]);
    }
    return out;
  };
  let stop = false;
  // rodadas paralelas de 5 buscas (bem mais rápido que uma por vez)
  for (let round = 0; round < Math.ceil(MAX_SEARCHES / 5) && chosen.length < DAILY && !stop; round++) {
    const batch = combos();
    if (!batch.length) break;
    const results = await Promise.all(batch.map(async ([niche, city]) => {
      try {
        const found: Cand[] = [];
        let token: string | undefined;
        for (let pg = 0; pg < 2; pg++) {
          const r = await search(niche, city, token);
          found.push(...r.list);
          // só pagina se ainda faltam novidades
          if (!r.next || found.filter((c) => !seen.has(c.place_id)).length >= 12) break;
          token = r.next;
        }
        return found;
      } catch (e) {
        console.error(e);
        const s = (e as { status?: number }).status;
        if (s === 402 || s === 403 || s === 429) stop = true;
        return [] as Cand[];
      }
    }));
    for (const found of results) {
      // filtra as já vistas ANTES de escolher, senão as melhores (repetidas) ocupam as vagas
      const fresh = found.filter((c) => !seen.has(c.place_id));
      const scored = fresh
        .map((c) => ({ c, L: learned(c, model) }))
        .filter((x) => x.L > -2.5)
        .map(({ c, L }) => ({ c, ok: qualifies(c, prof), s: similarity(c, prof) + Math.tanh(L / 4) * 0.6 + Math.random() * 0.1 }))
        .sort((a, b) => b.s - a.s);
      let taken = 0;
      for (const x of scored) {
        if (seen.has(x.c.place_id)) continue;
        if (x.ok && taken < per && chosen.length < DAILY) {
          seen.add(x.c.place_id); chosen.push(x.c); taken++;
        } else if ((x.c.rating ?? 0) >= 4.0 && x.c.reviews_count >= 10) backup.push({ c: x.c, s: x.s });
      }
    }
  }
  // se o filtro rígido não completou, completa com as melhores reservas (nunca repetidas)
  if (chosen.length < DAILY) {
    for (const x of backup.sort((a, b) => b.s - a.s)) {
      if (chosen.length >= DAILY) break;
      if (seen.has(x.c.place_id)) continue;
      seen.add(x.c.place_id); chosen.push(x.c);
    }
  }
  if (opts.replaceToday && chosen.length) {
    // guarda as de hoje como "já vistas" para nunca voltarem numa nova busca
    const { data: old } = await db.from("daily_leads").select("place_id,name,niche,rating,reviews_count,website,address").eq("user_id", userId).eq("found_on", todayRioBranco());
    if (old?.length) await db.from("mining_feedback").upsert(old.map((o) => ({ ...o, user_id: userId, kind: "visto" })) as never, { onConflict: "user_id,place_id,kind", ignoreDuplicates: true });
    await db.from("daily_leads").delete().eq("user_id", userId).eq("found_on", todayRioBranco());
  }
  if (chosen.length) {
    const { error } = await db
      .from("daily_leads")
      .upsert(chosen.map((c) => ({ ...c, user_id: userId })), { onConflict: "user_id,place_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  return chosen;
}

export function summary(chosen: Cand[]) {
  const count = new Map<string, number>();
  for (const c of chosen) count.set(c.niche, (count.get(c.niche) ?? 0) + 1);
  const top = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([n, q]) => `${q} ${n}`).join(", ");
  const cities = [...new Set(chosen.map((c) => c.city.split(",")[0]))].slice(0, 2).join(" e ");
  return `${chosen.length} empresas sem site prontas para abordar — ${top}${cities ? `, em ${cities}` : ""}.`;
}
