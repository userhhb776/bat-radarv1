// Ações que o assistente externo (Jarvis) pode executar no BatRadar, sempre presas ao dono do token.
import type { SupabaseClient } from "@supabase/supabase-js";
import { planCompanyTimes } from "@/lib/campaign-schedule";
import { distributeVariants, fillScript, scriptMessages, type Script } from "@/lib/scripts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";
import { canUse, prefixFor, isAppInstance } from "@/lib/wa-owner";
async function adminOf(sb: SupabaseClient, userId: string) { const { data } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" }); return data === true; }
type P = Record<string, unknown>;
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

export async function hashToken(t: string) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(t, "utf8").digest("hex");
}

export async function places(niche: string, city: string, minRating: number) {
  const lovable = process.env["LOVABLE_API_KEY"]; const maps = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovable || !maps) throw new Error("Google Maps não configurado.");
  const res = await fetch(`${GATEWAY_URL}/places/v1/places:searchText`, {
    method: "POST",
    headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": maps, "Content-Type": "application/json",
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri,places.businessStatus,places.photos.name" },
    body: JSON.stringify({ textQuery: `${niche} em ${city}`, pageSize: 20, languageCode: "pt-BR", regionCode: "BR", ...(minRating > 0 ? { minRating } : {}) }),
  });
  if (!res.ok) throw new Error(`Google Maps respondeu ${res.status}`);
  const j = (await res.json()) as { places?: Array<Record<string, any>> };
  return (j.places ?? []).filter((p) => p["businessStatus"] !== "CLOSED_PERMANENTLY").map((p) => ({
    place_id: String(p["id"]), name: p["displayName"]?.text ?? "Sem nome", phone: (p["internationalPhoneNumber"] ?? p["nationalPhoneNumber"] ?? null) as string | null,
    address: (p["formattedAddress"] ?? null) as string | null, website: (p["websiteUri"] ?? null) as string | null,
    rating: typeof p["rating"] === "number" ? p["rating"] : null, reviews_count: typeof p["userRatingCount"] === "number" ? p["userRatingCount"] : 0,
    maps_url: (p["googleMapsUri"] ?? null) as string | null, niche, city,
    photos: Array.isArray(p["photos"]) ? p["photos"].length : 0,
    open: p["businessStatus"] !== "CLOSED_TEMPORARILY",
  }));
}
type Place = Awaited<ReturnType<typeof places>>[number];
const noSite = (w: string | null) => !w || /instagram\.com|wa\.me|whatsapp\.com|api\.whatsapp|facebook\.com|linktr\.ee/i.test(w);

async function saveToBlock(sb: SupabaseClient, userId: string, blockId: string, rows: Place[]) {
  if (!rows.length) return 0;
  rows = rows.map(({ photos: _p, open: _o, ...r }: any) => r) as Place[];
  await sb.from("leads").upsert(rows.map((r) => ({ ...r, user_id: userId })), { onConflict: "user_id,place_id", ignoreDuplicates: true });
  const { error } = await sb.from("block_items").upsert(rows.map((r) => ({ ...r, block_id: blockId, user_id: userId })), { onConflict: "block_id,place_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  return rows.length;
}

async function wake(origin: string) {
  await fetch(`${origin}/api/public/hooks/wa-dispatch`, { method: "POST", headers: { Authorization: `Bearer ${process.env["LOVABLE_CRON_SECRET"]}` } }).catch(() => null);
}

export const ACTIONS = ["resumo", "listar_blocos", "listar_scripts", "listar_instancias", "buscar_leads", "criar_bloco", "salvar_no_bloco", "buscar_e_salvar", "listar_campanhas", "criar_campanha", "status_campanha"] as const;

export async function runAction(sb: SupabaseClient, userId: string, action: string, p: P, origin: string): Promise<unknown> {
  const own = (q: any): any => q.eq("user_id", userId);
  switch (action) {
    case "listar_blocos": {
      const { data } = await own(sb.from("lead_blocks").select("id,name,niche,created_at,block_items(count)")).order("created_at", { ascending: false });
      return (data ?? []).map((b: any) => ({ id: b.id, nome: b.name, nicho: b.niche, empresas: b.block_items?.[0]?.count ?? 0 }));
    }
    case "listar_scripts": {
      const { data } = await own(sb.from("scripts").select("id,title,niche,stage,body,message2,message3"));
      return (data ?? []).map((s: any) => ({ id: s.id, titulo: s.title, nicho: s.niche, objetivo: s.stage, mensagens: scriptMessages(s).length }));
    }
    case "listar_instancias": {
      const { base, key } = await (await import("@/lib/service-config.server")).getEvo();
      const r = await fetch(`${base}/instance/fetchInstances`, { headers: { apikey: key } });
      const list = (r.ok ? await r.json() : []) as Array<Record<string, unknown>>;
      const { data: st } = await own(sb.from("user_settings").select("wa_labels")).maybeSingle();
      const labels = ((st as any)?.wa_labels ?? {}) as Record<string, string>;
      const pre = prefixFor(userId) + "-"; const admin = await adminOf(sb, userId);
      return (Array.isArray(list) ? list : []).filter((i) => canUse(userId, admin, String(i["name"])))
        .map((i) => { const n = String(i["name"]); return { id: n, nome: labels[n] || (isAppInstance(n) ? n.slice(pre.length) : n), conectado: i["connectionStatus"] === "open" }; });
    }
    case "buscar_leads": {
      const niche = str(p["nicho"], 80), city = str(p["cidade"], 80);
      if (niche.length < 2 || city.length < 2) throw new Error("Informe nicho e cidade.");
      let r = await places(niche, city, num(p["nota_minima"], 0));
      if (p["sem_site"] === true) r = r.filter((x) => noSite(x.website));
      r = r.filter((x) => x.phone);
      return { total: r.length, leads: r };
    }
    case "criar_bloco": {
      const name = str(p["nome"], 120); if (!name) throw new Error("Informe o nome do bloco.");
      const { data, error } = await sb.from("lead_blocks").insert({ name, niche: str(p["nicho"], 80), user_id: userId }).select("id").single();
      if (error) throw new Error(error.message);
      return { id: data.id, nome: name };
    }
    case "salvar_no_bloco": {
      const blockId = str(p["bloco_id"], 60);
      const { data: b } = await own(sb.from("lead_blocks").select("id").eq("id", blockId)).maybeSingle();
      if (!b) throw new Error("Bloco não encontrado.");
      const leads = (Array.isArray(p["leads"]) ? p["leads"] : []) as Place[];
      return { salvas: await saveToBlock(sb, userId, blockId, leads.filter((l) => l?.place_id && l?.name).slice(0, 200)) };
    }
    case "buscar_e_salvar": {
      const found = (await runAction(sb, userId, "buscar_leads", p, origin)) as { leads: Place[] };
      const limit = Math.max(1, Math.min(60, num(p["limite"], 15)));
      let blockId = str(p["bloco_id"], 60);
      if (!blockId) blockId = ((await runAction(sb, userId, "criar_bloco", { nome: str(p["nome_bloco"], 120) || `${str(p["nicho"])} - ${str(p["cidade"])}`, nicho: p["nicho"] }, origin)) as { id: string }).id;
      const n = await saveToBlock(sb, userId, blockId, found.leads.slice(0, limit));
      return { bloco_id: blockId, salvas: n, empresas: found.leads.slice(0, limit).map((l) => l.name) };
    }
    case "listar_campanhas": {
      const { data: cs } = await own(sb.from("campaigns").select("id,name,status,start_at")).order("created_at", { ascending: false }).limit(30);
      const ids = (cs ?? []).map((c: any) => c.id);
      const { data: s } = ids.length ? await sb.from("wa_scheduled").select("campaign_id,status").in("campaign_id", ids).limit(10000) : { data: [] };
      return (cs ?? []).map((c: any) => {
        const m = (s ?? []).filter((x: any) => x.campaign_id === c.id);
        const k = (st: string) => m.filter((x: any) => x.status === st).length;
        return { id: c.id, nome: c.name, status: c.status, inicio: c.start_at, enviadas: k("enviada"), pendentes: k("pendente"), falhas: k("falhou"), canceladas: k("cancelada") };
      });
    }
    case "status_campanha": {
      const id = str(p["campanha_id"], 60), status = str(p["status"], 20);
      if (!["ativa", "pausada"].includes(status)) throw new Error("status deve ser 'ativa' ou 'pausada'.");
      const { error } = await own(sb.from("campaigns").update({ status }).eq("id", id));
      if (error) throw new Error(error.message);
      if (status === "ativa") await wake(origin);
      return { ok: true, id, status };
    }
    case "criar_campanha": {
      const blockId = str(p["bloco_id"], 60), scriptId = str(p["script_id"], 60), instance = str(p["instancia"], 80);
      if (!canUse(userId, await adminOf(sb, userId), instance)) throw new Error("Instância inválida. Use listar_instancias.");
      const { data: script } = await own(sb.from("scripts").select("*").eq("id", scriptId)).maybeSingle();
      if (!script) throw new Error("Script não encontrado.");
      const msgs = scriptMessages(script as Script); if (!msgs.length) throw new Error("O script não tem mensagens.");
      const { data: items } = await own(sb.from("block_items").select("*").eq("block_id", blockId));
      let list = (items ?? []).filter((i: any) => i.phone) as any[];
      if (!list.length) throw new Error("Bloco vazio ou sem telefones.");
      await sb.from("leads").upsert(list.map((r) => ({ user_id: userId, place_id: r.place_id, name: r.name, phone: r.phone, address: r.address, website: r.website, rating: r.rating, reviews_count: r.reviews_count, niche: r.niche, city: r.city, maps_url: r.maps_url })), { onConflict: "user_id,place_id", ignoreDuplicates: true });
      const { data: lr } = await own(sb.from("leads").select("id,place_id")).in("place_id", list.map((r) => r.place_id));
      const leadIds = new Map((lr ?? []).map((d: any) => [d.place_id, d.id]));
      const phones = list.map((i) => i.phone);
      const skip = new Set<string>();
      if (p["so_falhas"] === true) {
        const { data } = await own(sb.from("wa_scheduled").select("phone")).in("status", ["enviada", "pendente", "enviando"]).in("phone", phones).limit(5000);
        (data ?? []).forEach((d: any) => skip.add(d.phone));
      }
      if (((script as any).stage || "primeiro_contato") === "primeiro_contato") {
        const { data } = await own(sb.from("wa_scheduled").select("phone")).eq("status", "enviada").in("phone", phones).limit(5000);
        (data ?? []).forEach((d: any) => skip.add(d.phone));
      }
      const before = list.length; list = list.filter((i) => !skip.has(i.phone));
      if (!list.length) throw new Error("Todas as empresas desse bloco já foram abordadas. Use um script de follow-up.");
      const cfg = { fromH: num(p["hora_inicio"], 9), toH: num(p["hora_fim"], 18), days: Array.isArray(p["dias"]) ? (p["dias"] as number[]) : [1, 2, 3, 4, 5], dailyLimit: num(p["limite_diario"], 15), msgGap: num(p["intervalo_mensagens_s"], 25), minGap: num(p["intervalo_min_empresas_s"], 300), maxGap: num(p["intervalo_max_empresas_s"], 720) };
      if (cfg.toH <= cfg.fromH || !cfg.days.length) throw new Error("Janela de horário ou dias inválidos.");
      const now = p["comecar_agora"] === true;
      const startMs = now ? Date.now() + 20000 : (str(p["inicio"], 40) ? new Date(str(p["inicio"], 40)).getTime() : Date.now() + 60000);
      if (!Number.isFinite(startMs)) throw new Error("Data de início inválida (use ISO, ex.: 2026-10-16T09:00:00-05:00).");
      // o servidor roda em UTC; os horários da janela são do fuso do usuário (padrão Rio Branco, -300 min)
      const off = num(p["fuso_minutos"], -300) * 60000;
      const { data: c, error } = await sb.from("campaigns").insert({
        user_id: userId, name: str(p["nome"], 120) || "Campanha Jarvis", block_id: blockId, script_id: scriptId, instance, texts: msgs,
        msg_gap_s: cfg.msgGap, min_gap_s: cfg.minGap, max_gap_s: Math.max(cfg.minGap, cfg.maxGap), from_h: cfg.fromH, to_h: cfg.toH, days: cfg.days, daily_limit: cfg.dailyLimit, start_at: new Date(startMs).toISOString(),
      }).select("id").single();
      if (error) throw new Error(error.message);
      const times = planCompanyTimes(list.length, msgs.length, cfg, startMs + off, now).map((t) => t - off);
      const funnels = distributeVariants(script as Script, list.length);
      const rows: any[] = [];
      list.forEach((it, k) => funnels[k]!.forEach((m, i) => rows.push({ user_id: userId, campaign_id: c.id, instance, lead_id: leadIds.get(it.place_id) ?? null, name: it.name, phone: it.phone, texts: [fillScript(m, { name: it.name, city: it.city, niche: it.niche, rating: it.rating, reviews: it.reviews_count, website: it.website })], send_at: new Date(times[k]! + i * cfg.msgGap * 1000).toISOString() })));
      for (let i = 0; i < rows.length; i += 500) { const { error: e2 } = await sb.from("wa_scheduled").insert(rows.slice(i, i + 500)); if (e2) throw new Error(e2.message); }
      if (now) await wake(origin);
      return { id: c.id, empresas: list.length, ignoradas_ja_abordadas: before - list.length, mensagens: rows.length, primeiro_envio: rows[0]?.send_at };
    }
    case "resumo":
    default: {
      const [{ count: leads }, { count: pend }, { count: sent }] = await Promise.all([
        own(sb.from("leads").select("id", { count: "exact", head: true })),
        own(sb.from("wa_scheduled").select("id", { count: "exact", head: true }).eq("status", "pendente")),
        own(sb.from("wa_scheduled").select("id", { count: "exact", head: true }).eq("status", "enviada")),
      ]);
      return { leads_no_pipeline: leads ?? 0, mensagens_pendentes: pend ?? 0, mensagens_enviadas: sent ?? 0, acoes: ACTIONS };
    }
  }
}
