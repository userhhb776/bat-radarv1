import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireApprovedAccount } from "@/lib/access.middleware";

const ACTOR = "apify~facebook-ads-scraper";
const API = "https://api.apify.com/v2";

export type SpyAd = {
  ad_id: string; page_name: string | null; page_id: string | null; page_pic: string | null;
  body: string | null; title: string | null; cta: string | null; link_url: string | null;
  image_url: string | null; video_url: string | null; platforms: string[];
  start_date: string | null; end_date: string | null; is_active: boolean | null; days_running: number | null;
  library_url: string;
};

function toIso(v: any): string | null {
  if (v == null || v === "") return null;
  const d = typeof v === "number" ? new Date(v < 1e12 ? v * 1000 : v) : new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function snake(v: any): any {
  if (Array.isArray(v)) return v.map(snake);
  if (v && typeof v === "object") {
    const o: any = {};
    for (const [k, x] of Object.entries(v)) { const sk = k.replace(/ID$/, "Id").replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase(); o[sk] = snake(x); if (!(k in o)) o[k] = o[sk]; }
    return o;
  }
  return v;
}

export function normalizeAd(raw: any): SpyAd | null {
  const it = snake(raw);
  const s = it?.snapshot ?? {};
  const id = String(it?.ad_archive_id ?? it?.adArchiveID ?? it?.adArchiveId ?? it?.id ?? "");
  if (!id) return null;
  const card = Array.isArray(s.cards) && s.cards[0] ? s.cards[0] : {};
  const img = s.images?.[0]?.original_image_url ?? s.images?.[0]?.resized_image_url ?? card.original_image_url ?? card.resized_image_url ?? s.videos?.[0]?.video_preview_image_url ?? card.video_preview_image_url ?? null;
  const vid = s.videos?.[0]?.video_sd_url ?? s.videos?.[0]?.video_hd_url ?? card.video_sd_url ?? null;
  let body = s.body?.text ?? s.body?.markup?.__html ?? card.body ?? null;
  if (body && /\{\{product\./.test(body)) body = card.body ?? body;
  const start = toIso(it?.start_date ?? it?.startDate ?? it?.start_date_formatted);
  const end = toIso(it?.end_date ?? it?.endDate);
  const active = typeof it?.is_active === "boolean" ? it.is_active : typeof it?.isActive === "boolean" ? it.isActive : null;
  const days = start ? Math.max(0, Math.round(((active === false && end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime()) / 86400000)) : null;
  return {
    ad_id: id, page_name: it?.page_name ?? s.page_name ?? null, page_id: String(it?.page_id ?? s.page_id ?? "") || null,
    page_pic: s.page_profile_picture_url ?? null, body, title: s.title ?? card.title ?? null, cta: s.cta_text ?? card.cta_text ?? null,
    link_url: s.link_url ?? card.link_url ?? null, image_url: img, video_url: vid,
    platforms: Array.isArray(it?.publisher_platform) ? it.publisher_platform : Array.isArray(it?.publisherPlatform) ? it.publisherPlatform : [],
    start_date: start, end_date: end, is_active: active, days_running: days,
    library_url: `https://www.facebook.com/ads/library/?id=${id}`,
  };
}

const searchSchema = z.object({
  q: z.string().trim().min(2).max(120),
  country: z.string().regex(/^[A-Z]{2}$|^ALL$/).default("BR"),
  active: z.enum(["active", "all", "inactive"]).default("active"),
  media: z.enum(["all", "image", "video", "meme"]).default("all"),
  limit: z.number().int().min(10).max(100).default(30),
});

export const searchAds = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => searchSchema.parse(d))
  .handler(async ({ data }) => {
    const key = process.env["APIFY_API_KEY"];
    if (!key) throw new Error("Chave da Apify não configurada.");
    const url = `https://www.facebook.com/ads/library/?active_status=${data.active}&ad_type=all&country=${data.country}&q=${encodeURIComponent(data.q)}&search_type=keyword_unordered&media_type=${data.media}`;
    const r = await fetch(`${API}/acts/${ACTOR}/run-sync-get-dataset-items?timeout=180&clean=true`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ startUrls: [{ url }], resultsLimit: data.limit, activeStatus: data.active === "all" ? "" : data.active }),
      signal: AbortSignal.timeout(200000),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error("apify", r.status, t.slice(0, 500));
      if (r.status === 402 || /usage|credit|limit/i.test(t)) throw new Error("Saldo da Apify acabou. Veja em Sistema e troque a chave.");
      throw new Error(`A Apify respondeu ${r.status}. Tente de novo em instantes.`);
    }
    const items = (await r.json().catch(() => [])) as any[];
    const ads = (Array.isArray(items) ? items : []).map(normalizeAd).filter(Boolean) as SpyAd[];
    const seen = new Set<string>();
    return { ads: ads.filter((a) => (seen.has(a.ad_id) ? false : (seen.add(a.ad_id), true))), searchedAt: new Date().toISOString() };
  });

export const listSavedAds = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any).from("ad_spy_saved").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

export const saveAd = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => z.object({ mode: z.enum(["empresas", "ofertas"]), country: z.string().max(5), keyword: z.string().max(120), ad: z.any() }).parse(d))
  .handler(async ({ data, context }) => {
    const a = data.ad as SpyAd;
    const row = { user_id: context.userId, mode: data.mode, ad_id: String(a.ad_id).slice(0, 60), page_name: a.page_name, page_id: a.page_id, body: a.body?.slice(0, 8000), title: a.title, cta: a.cta, link_url: a.link_url, image_url: a.image_url, video_url: a.video_url, platforms: a.platforms ?? [], start_date: a.start_date, is_active: a.is_active, country: data.country, keyword: data.keyword };
    const { error } = await (context.supabase as any).from("ad_spy_saved").upsert(row, { onConflict: "user_id,ad_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateSavedAd = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), notes: z.string().max(2000).optional(), remove: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const q = data.remove ? sb.from("ad_spy_saved").delete().eq("id", data.id) : sb.from("ad_spy_saved").update({ notes: data.notes ?? null }).eq("id", data.id);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adToLead = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => z.object({ ad: z.any(), keyword: z.string().max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const a = data.ad as SpyAd;
    const row = { user_id: context.userId, place_id: `fbads:${a.page_id || a.ad_id}`, name: a.page_name || "Anunciante", website: a.link_url, niche: data.keyword, source: "externo", source_url: a.library_url, status: "novo" };
    const { error } = await (context.supabase as any).from("leads").upsert(row, { onConflict: "user_id,place_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getApifyStatus = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .handler(async () => {
    const key = process.env["APIFY_API_KEY"];
    if (!key) return { ok: false, error: "Chave não configurada" } as const;
    try {
      const [me, lim] = await Promise.all([
        fetch(`${API}/users/me`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) }),
        fetch(`${API}/users/me/limits`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) }),
      ]);
      if (me.status === 401) return { ok: false, error: "Chave recusada (excluída ou inválida)" } as const;
      const u = (await me.json()).data ?? {};
      const l = (await lim.json().catch(() => ({}))).data ?? {};
      const used = Number(l.current?.monthlyUsageUsd ?? 0);
      const max = Number(l.limits?.maxMonthlyUsageUsd ?? 5);
      return { ok: true, error: null, user: u.username ?? "", plan: u.plan?.id ?? "FREE", used, max, left: Math.max(0, max - used), resetAt: l.monthlyUsageCycle?.endAt ?? null } as const;
    } catch { return { ok: false, error: "Apify sem resposta" } as const; }
  });
