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
      sb.from("agent_leads").select("id,name,phone,city,niche,rating,reviews_count,website,address,maps_url,photos,qualification,status,send_at,created_at").eq("agent_id", data.id).order("created_at", { ascending: false }).limit(300),
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
    id: z.string().uuid(), context: z.string().max(6000), style: z.string().max(4000), pace: z.string().regex(/^(rapido|equilibrado|calmo|s:\d{1,4}-\d{1,4})$/),
    script_steps: z.array(step).max(10),
    miner: z.object({ niche: z.string().max(80).optional(), city: z.string().max(80).optional(), sem_site: z.boolean().optional(), nota_minima: z.number().min(0).max(5).optional(), daily: z.number().int().min(1).max(60).optional(), auto: z.boolean().optional(), auto_approach: z.boolean().optional(),
      min_reviews: z.number().int().min(0).max(500).optional(), min_photos: z.number().int().min(0).max(10).optional(), web_scan: z.boolean().optional(),
      hora_inicio: z.number().int().min(0).max(23).optional(), hora_fim: z.number().int().min(1).max(24).optional(), limite_dia: z.number().int().min(1).max(200).optional(), states: z.array(z.string().length(2)).max(27).optional(), btx_opening: z.boolean().optional(), md_teste: z.boolean().optional(), niches: z.array(z.string().max(80)).max(10).optional(), dias: z.array(z.number().int().min(0).max(6)).max(7).optional(), gap_min: z.number().min(1).max(240).optional(), gap_max: z.number().min(1).max(480).optional(), open_gap_min: z.number().min(1).max(300).optional(), open_gap_max: z.number().min(1).max(300).optional() }),
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
    const { openingFor } = await import("@/lib/agents.server");
    const approach = data.approach && !a.miner?.md_teste && !!a.instance && !!openingFor(a);
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

// ---------- B-T6X: roteiro de abordagem com situações e variações ----------
const btxRule = z.object({ when: z.string().max(300), variants: z.array(z.string().max(1500)).max(6), mode: z.enum(["alternatives", "sequence"]).optional(), audio_id: z.string().max(60).optional() });
const btxSchema = z.object({ prompt: z.string().max(8000), rules: z.array(btxRule).max(25) });

export const saveBtx = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), btx: btxSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("agents").update({ btx: data.btx }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function ask(agent: any, prompt: string) {
  const fallback = (await (await import("@/lib/service-config.server")).getOllamaKey()) ?? "";
  const key = agent.ai_provider === "custom" && agent.ai_key ? agent.ai_key : fallback;
  if (!key) throw new Error("Chave de IA não configurada.");
  const res = await fetch("https://ollama.com/api/chat", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: agent.model || "gpt-oss:120b", stream: false, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(res.status === 429 ? "Limite da IA atingido." : `IA respondeu ${res.status}.`);
  return String(((await res.json()) as any).message?.content ?? "").trim();
}

/** Gera uma variação da mensagem trocando palavras por sinônimos, mantendo sentido e tom. */
export const varyMessage = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), text: z.string().min(1).max(1500) }).parse(d))
  .handler(async ({ data, context }) => {
    const a = await loadAgent(context.supabase, data.id);
    const out = await ask(a, `Reescreva a mensagem de WhatsApp abaixo com o MESMO sentido, tamanho e tom informal, trocando algumas palavras por sinônimos e mudando levemente a ordem. Mantenha placeholders como {nome} intactos e linhas em branco entre balões. Responda só com a nova mensagem, sem aspas.\n\n${data.text}`);
    return { text: out.replace(/^["']|["']$/g, "").slice(0, 1500) };
  });

/** Transforma o prompt do B-T6X em situações + respostas (plano de funil). */
export const buildBtxPlan = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), prompt: z.string().min(5).max(8000) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const a = await loadAgent(sb, data.id);
    const { data: blocks } = await sb.from("scripts").select("title,body,message2,message3");
    const ref = (blocks ?? []).map((s: any) => `[${s.title}]\n${[s.body, s.message2, s.message3].filter(Boolean).join("\n---\n")}`).join("\n\n").slice(0, 5000);
    const out = await ask(a, `Você é um arquiteto de fluxos de WhatsApp. Converta as instruções do dono em um funil operacional, fiel ao conteúdo original. Responda APENAS JSON válido neste formato: {"rules":[{"when":"título claro e específico","mode":"alternatives","variants":["texto"]}]}.

REGRAS OBRIGATÓRIAS DE ESTRUTURA:
1. Cada cartão ("when") representa uma situação ou uma mensagem numerada, com título descritivo. Nunca use títulos vagos como "abordagem inicial", "cliente recusou", "cliente aceitou" ou "resposta".
2. Para a abertura, nomeie cada balão enviado em sequência como cartões separados: "Abordagem inicial — Mensagem 1", "Abordagem inicial — Mensagem 2", "Abordagem inicial — Mensagem 3". Cada cartão contém SOMENTE o texto daquele balão. Não coloque a Mensagem 2 como variação da Mensagem 1.
3. Use mode="alternatives" SOMENTE para textos diferentes que comunicam a MESMA mensagem, para a MESMA situação e no MESMO momento. As variações devem ser intercambiáveis sem mudar a etapa do funil.
4. Quando o cliente precisa responder antes de a próxima mensagem ser enviada, isso é uma etapa posterior, nunca uma variação. Represente como cartões numerados de uma sequência, por exemplo "Cliente aceita receber a apresentação — Passo 1", "Cliente aceita receber a apresentação — Passo 2". Cada cartão contém somente uma mensagem daquele passo.
5. Se o dono descreveu mensagens que devem ser enviadas uma após outra sem aguardar resposta, use "Mensagem 1", "Mensagem 2" etc. Se descreveu avanço após resposta do cliente, use "Passo 1", "Passo 2" etc.
6. Separe claramente situações diferentes: cliente pergunta preço; cliente diz que já possui equipe/agência; cliente pede para falar por e-mail; cliente recusa/não tem interesse; cliente demonstra interesse/aceita; cliente pede mais informações. Não misture suas respostas.
7. Os títulos devem explicar o gatilho com contexto suficiente para o agente identificar a situação. Preserve a ordem do funil e não invente mensagens ou etapas que o dono não forneceu.
8. Se houver um script salvo pelo nome, use o conteúdo literal dele. Se houver dúvida, prefira manter a mensagem original e sinalizar a situação de forma específica, sem inventar.

SCRIPTS SALVOS:
${ref || "nenhum"}

INSTRUÇÕES DO DONO:
${data.prompt}`);
    const m = out.match(/\{[\s\S]*\}/);
    const parsed = btxSchema.shape.rules.safeParse(m ? JSON.parse(m[0]).rules : null);
    if (!parsed.success) throw new Error("A IA não devolveu um plano válido. Tente de novo.");
    const { normalizeGeneratedBtxRules } = await import("@/lib/agents.server");
    const normalized = normalizeGeneratedBtxRules(parsed.data);
    if (!normalized.length) throw new Error("O funil veio sem mensagens válidas. Revise as instruções e tente novamente.");
    return { rules: normalized };
  });

/** TESTE V2: liga o treino e manda a abordagem real para o número do dono, que finge ser cliente. */
export const startTestV2 = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => idOnly.parse(d))
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!admin) throw new Error("Teste V2 é exclusivo do administrador.");
    const a = await loadAgent(context.supabase, data.id);
    if (!a.instance) throw new Error("Escolha o número do agente primeiro.");
    const { openingMessagesFor, fillTemplate, adaptGreeting, openGapMs } = await import("@/lib/agents.server");
    const blocks = openingMessagesFor({ ...a, miner: { ...(a.miner ?? {}), btx_opening: true } } as any);
    if (!blocks.length) throw new Error("Configure uma mensagem de abordagem antes.");
    const phone = "5568992316302";
    await (context.supabase as any).from("agents").update({ active: true, training_mode: true, training_phone: phone, miner: { ...(a.miner ?? {}), md_teste: false } }).eq("id", a.id);
    const { evoSend } = await import("@/lib/evolution.server");
    const texts = blocks.map((block) => adaptGreeting(fillTemplate(block, { name: "Empresa Teste", city: "Rio Branco" } as any)));
    await evoSend(a.instance, phone, texts, openGapMs(a));
    for (const b of texts) await (context.supabase as any).from("agent_messages").insert({ user_id: context.userId, agent_id: a.id, phone, contact_name: "TESTE V2", direction: "out", body: b });
    return { ok: true };
  });

/** Aprova o treino: desliga o md-teste e põe na fila real todas as empresas do teste (nenhuma se perde). */
export const approveTest = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => idOnly.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const a = await loadAgent(sb, data.id);
    const m = a.miner ?? {};
    await sb.from("agents").update({ miner: { ...m, md_teste: false }, active: true }).eq("id", a.id);
    const { data: rows } = await sb.from("agent_leads").select("id").eq("agent_id", a.id).eq("status", "teste").not("phone", "is", null);
    const gMin = Number(m.gap_min ?? 6), gMax = Math.max(gMin, Number(m.gap_max ?? 15));
    let t = Date.now() + 2 * 60000;
    for (const r of (rows ?? []) as any[]) {
      t += (gMin + Math.random() * (gMax - gMin)) * 60000;
      await sb.from("agent_leads").update({ status: "fila", send_at: new Date(t).toISOString() }).eq("id", r.id);
    }
    const { logEvent } = await import("@/lib/agents.server");
    await logEvent(sb, a, "aprovou", `Treino aprovado: ${rows?.length ?? 0} empresas foram para a fila real`);
    return { aprovadas: rows?.length ?? 0 };
  });
