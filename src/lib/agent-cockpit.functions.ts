import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireApprovedAccount } from "@/lib/access.middleware";

const idOnly = z.object({ id: z.string().uuid() });
const digits = (s: string) => s.replace(/\D/g, "");

async function loadAgent(sb: any, id: string) {
  const { data } = await sb.from("agents").select("*").eq("id", id).single();
  if (!data) throw new Error("Agente não encontrado.");
  return data as any;
}

export const agentCockpit = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => idOnly.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const a = await loadAgent(sb, data.id);
    const [ev, leads, msgs, pauses, audios] = await Promise.all([
      sb.from("agent_events").select("kind,text,created_at").eq("agent_id", data.id).order("created_at", { ascending: false }).limit(40),
      sb.from("agent_leads").select("id,name,phone,city,niche,rating,reviews_count,website,status,send_at,created_at").eq("agent_id", data.id).order("created_at", { ascending: false }).limit(300),
      sb.from("agent_messages").select("id,phone,contact_name,direction,body,hot,manual,created_at").eq("agent_id", data.id).order("created_at", { ascending: false }).limit(400),
      sb.from("agent_pauses").select("phone").eq("agent_id", data.id),
      sb.from("agent_audios").select("id,title,trigger,created_at").eq("agent_id", data.id).order("created_at"),
    ]);
    const L = (leads.data ?? []) as any[];
    const M = (msgs.data ?? []) as any[];
    const count = (s: string) => L.filter((l) => l.status === s).length;
    return {
      agent: { ...a, ai_key: a.ai_key ? "••••" + String(a.ai_key).slice(-4) : "" },
      events: ev.data ?? [], leads: L, messages: M, paused: (pauses.data ?? []).map((p: any) => p.phone), audios: audios.data ?? [],
      stats: { mineradas: L.length, fila: count("fila"), abordadas: count("abordado") + count("respondeu") + count("quente"), responderam: count("respondeu") + count("quente"), quentes: count("quente"), enviadas: M.filter((m) => m.direction === "out" && !String(m.phone).startsWith("treino")).length },
    };
  });

const step = z.object({ title: z.string().max(120), goal: z.string().max(600), message: z.string().max(2000) });
export const saveAgentDetails = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(), context: z.string().max(6000), style: z.string().max(4000), pace: z.enum(["rapido", "equilibrado", "calmo"]),
    script_steps: z.array(step).max(10),
    miner: z.object({ niche: z.string().max(80).optional(), city: z.string().max(80).optional(), sem_site: z.boolean().optional(), nota_minima: z.number().min(0).max(5).optional(), daily: z.number().int().min(1).max(60).optional(), auto: z.boolean().optional(), auto_approach: z.boolean().optional(),
      min_reviews: z.number().int().min(0).max(500).optional(), min_photos: z.number().int().min(0).max(10).optional(), web_scan: z.boolean().optional(),
      hora_inicio: z.number().int().min(0).max(23).optional(), hora_fim: z.number().int().min(1).max(24).optional(), limite_dia: z.number().int().min(1).max(200).optional() }),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await (context.supabase as any).from("agents").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runAgentMiner = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => idOnly.parse(d))
  .handler(async ({ data, context }) => {
    const a = await loadAgent(context.supabase, data.id);
    const { mineForAgent } = await import("@/lib/agents.server");
    return mineForAgent(context.supabase as any, a);
  });

export const sendManual = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), phone: z.string().min(6).max(40), name: z.string().max(120).optional(), text: z.string().trim().min(1).max(3000) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const a = await loadAgent(sb, data.id);
    if (!a.instance) throw new Error("Agente sem número de WhatsApp.");
    const phone = digits(data.phone);
    const { evoSend } = await import("@/lib/evolution.server");
    await evoSend(a.instance, phone, [data.text]);
    await sb.from("agent_messages").insert({ user_id: context.userId, agent_id: a.id, phone, contact_name: data.name ?? "", direction: "out", body: data.text, manual: true });
    // quando você assume, a IA fica quieta nessa conversa até você devolver
    await sb.from("agent_pauses").upsert({ agent_id: a.id, phone, user_id: context.userId });
    return { ok: true };
  });

export const setPause = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), phone: z.string().max(40), paused: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    if (data.paused) await sb.from("agent_pauses").upsert({ agent_id: data.id, phone: data.phone, user_id: context.userId });
    else await sb.from("agent_pauses").delete().eq("agent_id", data.id).eq("phone", data.phone);
    return { ok: true };
  });

export const addAudio = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(80), trigger: z.string().max(300), mime: z.string().max(60), data: z.string().min(100).max(2_000_000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("agent_audios").insert({ user_id: context.userId, agent_id: data.id, title: data.title, trigger: data.trigger, mime: data.mime, data: data.data });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAudio = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => idOnly.parse(d))
  .handler(async ({ data, context }) => {
    await (context.supabase as any).from("agent_audios").delete().eq("id", data.id);
    return { ok: true };
  });

/** Lê o print com IA, guarda só o aprendizado em texto. A imagem não é salva em lugar nenhum. */
export const studyPrint = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), image: z.string().startsWith("data:image/").max(4_000_000), note: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const a = await loadAgent(sb, data.id);
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Leitura de imagens indisponível.");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [{ role: "user", content: [
          { type: "text", text: `Este é um print de conversa de WhatsApp em que o vendedor (Antonio, mensagens do lado direito/verde) fala com um cliente. ${data.note ? `Observação do dono: ${data.note}. ` : ""}Extraia, em pt-BR e no máximo 12 linhas curtas: como ele abre a conversa, tamanho e tom das frases, gírias/expressões que usa, como responde dúvidas e objeções, como conduz até o fechamento, e 2-3 frases exemplares dele (literais). Não invente nada que não esteja no print. Comece direto, sem introdução.` },
          { type: "image_url", image_url: { url: data.image } },
        ] }],
      }),
    });
    if (!res.ok) throw new Error(res.status === 429 ? "Muitas leituras seguidas, tente em 1 minuto." : res.status === 402 ? "Créditos de IA esgotados." : "Não consegui ler a imagem.");
    const j: any = await res.json();
    const lesson = String(j?.choices?.[0]?.message?.content ?? "").trim().slice(0, 2000);
    if (!lesson) throw new Error("Não encontrei conversa no print.");
    const learned = `${a.learned ?? ""}\n[Estudo de print ${new Date().toLocaleDateString("pt-BR")}]\n${lesson}`.trim().slice(-8000);
    await sb.from("agents").update({ learned }).eq("id", a.id);
    const { logEvent } = await import("@/lib/agents.server");
    await logEvent(sb, a, "estudo", "Estudou um print de conversa");
    return { lesson };
  });

export const moveToMyLeads = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), leadIds: z.array(z.string().uuid()).min(1).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: rows } = await sb.from("agent_leads").select("*").eq("agent_id", data.id).in("id", data.leadIds);
    const ins = (rows ?? []).map((l: any) => ({ user_id: context.userId, place_id: l.place_id, name: l.name, phone: l.phone, address: l.address, website: l.website, rating: l.rating, reviews_count: l.reviews_count, niche: l.niche, city: l.city, maps_url: l.maps_url, status: "novo", source: "agente" }));
    if (ins.length) { const { error } = await sb.from("leads").upsert(ins, { onConflict: "user_id,place_id", ignoreDuplicates: true }); if (error) throw new Error(error.message); }
    await sb.from("agent_leads").update({ status: "movido" }).in("id", data.leadIds).eq("agent_id", data.id);
    return { movidos: ins.length };
  });

export const importBlockToAgent = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), blockId: z.string().uuid(), approach: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const a = await loadAgent(sb, data.id);
    const { data: items } = await sb.from("block_items").select("*").eq("block_id", data.blockId).not("phone", "is", null).limit(300);
    const approach = data.approach && !!a.instance && !!a.script_steps?.[0]?.message;
    let t = Date.now() + 2 * 60000;
    const rows = (items ?? []).map((x: any) => { t += (6 + Math.random() * 9) * 60000; return { user_id: context.userId, agent_id: a.id, place_id: x.place_id, name: x.name, phone: x.phone, address: x.address, website: x.website, rating: x.rating, reviews_count: x.reviews_count ?? 0, niche: x.niche ?? "", city: x.city ?? "", maps_url: x.maps_url, status: approach ? "fila" : "novo", send_at: approach ? new Date(t).toISOString() : null }; });
    if (rows.length) await sb.from("agent_leads").upsert(rows, { onConflict: "agent_id,place_id", ignoreDuplicates: true });
    const { logEvent } = await import("@/lib/agents.server");
    await logEvent(sb, a, "importou", `Recebeu ${rows.length} empresas de um bloco seu${approach ? " e agendou a abordagem" : ""}`);
    return { importadas: rows.length, approach };
  });

export const listMyBlocks = createServerFn({ method: "GET" })
  .middleware([requireApprovedAccount])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any).from("lead_blocks").select("id,name").order("created_at", { ascending: false }).limit(100);
    return (data ?? []) as Array<{ id: string; name: string }>;
  });
