import type { SupabaseClient } from "@supabase/supabase-js";

// Cérebro dos agentes: um só motor para (1) responder clientes no WhatsApp,
// (2) receber ordens do dono no modo treinamento e (3) conversar pelo painel.
export type Agent = {
  id: string; user_id: string; name: string; mission: string; offer: string; rules: string; ideal_client: string;
  learned: string; instance: string; ai_provider: string; ai_key: string | null; model: string;
  active: boolean; auto_reply: boolean; training_mode: boolean; training_phone: string;
  context?: string; style?: string; pace?: string; script_steps?: Step[]; miner?: Miner; btx?: Btx;
};
export type BtxRule = { when: string; variants: string[]; audio_id?: string };
export type Btx = { prompt?: string; rules?: BtxRule[] };
export type Step = { title: string; goal: string; message: string };
export type Miner = { niche?: string; city?: string; sem_site?: boolean; nota_minima?: number; daily?: number; auto?: boolean; auto_approach?: boolean; min_reviews?: number; min_photos?: number; web_scan?: boolean; hora_inicio?: number; hora_fim?: number; limite_dia?: number };

type Tool = { name: string; description: string; properties: Record<string, unknown>; required?: string[] };

const PANEL_TOOLS: Tool[] = [
  { name: "resumo", description: "Números gerais do painel.", properties: {} },
  { name: "listar_blocos", description: "Lista blocos de leads.", properties: {} },
  { name: "listar_scripts", description: "Lista scripts de abordagem.", properties: {} },
  { name: "listar_instancias", description: "Lista números de WhatsApp.", properties: {} },
  { name: "listar_campanhas", description: "Lista campanhas.", properties: {} },
  { name: "buscar_leads", description: "Busca empresas no Google Maps (não salva).", properties: { nicho: { type: "string" }, cidade: { type: "string" }, nota_minima: { type: "number" }, sem_site: { type: "boolean" } }, required: ["nicho", "cidade"] },
  { name: "buscar_e_salvar", description: "Minera empresas e salva num bloco.", properties: { nicho: { type: "string" }, cidade: { type: "string" }, limite: { type: "number" }, sem_site: { type: "boolean" }, nota_minima: { type: "number" }, bloco_id: { type: "string" }, nome_bloco: { type: "string" } }, required: ["nicho", "cidade"] },
  { name: "criar_campanha", description: "Cria campanha de WhatsApp para um bloco.", properties: { nome: { type: "string" }, bloco_id: { type: "string" }, script_id: { type: "string" }, instancia: { type: "string" }, comecar_agora: { type: "boolean" }, hora_inicio: { type: "number" }, hora_fim: { type: "number" }, limite_diario: { type: "number" } }, required: ["bloco_id", "script_id", "instancia"] },
  { name: "status_campanha", description: "Pausa ou ativa campanha.", properties: { campanha_id: { type: "string" }, status: { type: "string", enum: ["ativa", "pausada"] } }, required: ["campanha_id", "status"] },
  { name: "conversa_com", description: "Mostra as mensagens trocadas com um cliente (busca por nome ou telefone).", properties: { busca: { type: "string" } }, required: ["busca"] },
  { name: "conversas_recentes", description: "Lista os últimos clientes que falaram com o agente e quais merecem atenção.", properties: {} },
  { name: "aprender", description: "Grava uma nova regra/preferência do dono na memória permanente do agente.", properties: { regra: { type: "string" } }, required: ["regra"] },
  { name: "minerar_agente", description: "Minera empresas para a carteira PRÓPRIA deste agente (separada dos leads do dono) e, se configurado, agenda a abordagem.", properties: { nicho: { type: "string" }, cidade: { type: "string" }, limite: { type: "number" } } },
  { name: "enviar_mensagem", description: "Envia uma mensagem de WhatsApp para um telefone pelo número do agente.", properties: { telefone: { type: "string" }, texto: { type: "string" } }, required: ["telefone", "texto"] },
];

const CLIENT_TOOLS: Tool[] = [
  { name: "enviar_audio", description: "Envia um dos áudios gravados pelo dono, quando o gatilho dele combina com o momento da conversa. Use no lugar de explicar por texto.", properties: { audio_id: { type: "string" } }, required: ["audio_id"] },
  { name: "responder_btx", description: "Responde usando a resposta PRONTA do roteiro B-T6X para a situação indicada (número da situação). Use SEMPRE que a fala do cliente combinar com uma situação do B-T6X.", properties: { situacao: { type: "number" } }, required: ["situacao"] },
  { name: "avisar_dono", description: "Avisa o dono que este cliente está quente / quer fechar / pediu humano.", properties: { motivo: { type: "string" } }, required: ["motivo"] },
];

function brief(a: Agent) {
  return `Você é ${a.name}, agente de vendas que trabalha para o Antonio.
MISSÃO: ${a.mission || "prospectar e conversar com empresas"}
O QUE VENDE (adapte-se, não é sempre site): ${a.offer || "pergunte ao dono"}
CLIENTE IDEAL: ${a.ideal_client || "não definido"}
REGRAS RÍGIDAS DO DONO (siga sempre): ${a.rules || "nenhuma"}
CONTEXTO DO NEGÓCIO: ${a.context || "—"}
COMO FALAR: ${a.style || "como gente, curto, natural"}
ROTEIRO DE VENDA (siga as etapas em ordem, sem pular):
${stepsText(a)}
APRENDIZADOS (inclui estudo de conversas reais do dono — imite o jeito dele): ${a.learned || "nenhum"}
Hoje: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Rio_Branco" })}.`;
}

function stepsText(a: Agent) {
  const st = Array.isArray(a.script_steps) ? a.script_steps : [];
  return st.length ? st.map((x, i) => `${i + 1}. ${x.title}${x.goal ? ` — objetivo: ${x.goal}` : ""}${x.message ? `\n   modelo: ${x.message}` : ""}`).join("\n") : "(sem roteiro: conduza curiosidade → entender a dor → oferta → passar pro dono)";
}

export async function logEvent(sb: SupabaseClient, a: { id: string; user_id: string }, kind: string, text: string) {
  await sb.from("agent_events").insert({ user_id: a.user_id, agent_id: a.id, kind, text: text.slice(0, 500) });
}

async function scriptsTone(sb: SupabaseClient, userId: string) {
  const { data } = await sb.from("scripts").select("title,body,message2,message3").eq("user_id", userId).limit(3);
  return (data ?? []).map((s: any) => `[${s.title}]\n${[s.body, s.message2, s.message3].filter(Boolean).join("\n")}`).join("\n\n").slice(0, 3000);
}

async function llm(a: Agent, fallbackKey: string, messages: any[], tools: Tool[]) {
  const key = a.ai_provider === "custom" && a.ai_key ? a.ai_key : fallbackKey;
  if (!key) throw new Error("Chave de IA não configurada.");
  const res = await fetch("https://ollama.com/api/chat", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: a.model || "gpt-oss:120b", stream: false, messages, tools: tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: { type: "object", properties: t.properties, required: t.required ?? [] } } })) }),
  });
  if (!res.ok) throw new Error(res.status === 429 ? "Limite da IA atingido." : res.status === 401 ? "Chave de IA inválida." : `IA respondeu ${res.status}.`);
  const j = (await res.json()) as { message?: { content?: string; tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }> } };
  return j.message ?? {};
}

const digits = (s: string) => s.replace(/\D/g, "");

async function ownerTool(sb: SupabaseClient, a: Agent, name: string, p: Record<string, any>, origin: string) {
  if (name === "conversa_com") {
    const q = String(p["busca"] ?? "").trim();
    const d = digits(q);
    let qb = sb.from("agent_messages").select("phone,contact_name,direction,body,created_at").eq("user_id", a.user_id).order("created_at", { ascending: false }).limit(40);
    qb = d.length >= 6 ? qb.like("phone", `%${d.slice(-8)}%`) : qb.ilike("contact_name", `%${q}%`);
    const { data } = await qb;
    if (!data?.length) return { aviso: "Nenhuma conversa encontrada." };
    return data.reverse().map((m: any) => `${m.direction === "in" ? m.contact_name || m.phone : a.name}: ${m.body}`);
  }
  if (name === "conversas_recentes") {
    const { data } = await sb.from("agent_messages").select("phone,contact_name,direction,body,hot,created_at").eq("user_id", a.user_id).order("created_at", { ascending: false }).limit(150);
    const seen = new Map<string, any>();
    for (const m of data ?? []) { const s = seen.get(m.phone) ?? { cliente: m.contact_name || m.phone, telefone: m.phone, ultima: m.body, quando: m.created_at, quente: false, msgs: 0 }; s.msgs++; s.quente ||= m.hot; seen.set(m.phone, s); }
    return [...seen.values()].slice(0, 15);
  }
  if (name === "aprender") {
    const learned = `${a.learned}\n- ${String(p["regra"] ?? "").slice(0, 500)}`.trim().slice(-6000);
    await sb.from("agents").update({ learned }).eq("id", a.id);
    a.learned = learned;
    return { ok: true };
  }
  if (name === "enviar_mensagem") {
    if (!a.instance) return { erro: "Agente sem número de WhatsApp." };
    const { evoSend } = await import("@/lib/evolution.server");
    await evoSend(a.instance, String(p["telefone"]), [String(p["texto"])]);
    await sb.from("agent_messages").insert({ user_id: a.user_id, agent_id: a.id, phone: digits(String(p["telefone"])), direction: "out", body: String(p["texto"]) });
    return { ok: true };
  }
  if (name === "minerar_agente") return mineForAgent(sb, a, { niche: p["nicho"], city: p["cidade"], limit: p["limite"] });
  const { runAction } = await import("@/lib/jarvis.server");
  return runAction(sb, a.user_id, name, p, origin);
}

/** Conversa com o dono (painel ou WhatsApp em modo treinamento): controle total do painel. */
export async function agentOwnerChat(sb: SupabaseClient, a: Agent, fallbackKey: string, history: Array<{ role: string; content: string }>, origin: string) {
  const sys = `${brief(a)}
Você está falando com o SEU DONO (Antonio). Continue a conversa a partir do histórico, sem se reapresentar. Obedeça ordens e execute com as ferramentas, sem pedir confirmação para leituras. Quando ele ensinar algo novo (preferência, tipo de empresa, regra, jeito de falar), use "aprender". Respostas curtas e precisas, como o Jarvis, sem falar de "modo IA" ou "modo painel". Nunca invente dados.`;
  const convo: any[] = [{ role: "system", content: sys }, ...history];
  const actions: string[] = [];
  for (let i = 0; i < 8; i++) {
    const m = await llm(a, fallbackKey, convo, PANEL_TOOLS);
    const calls = m.tool_calls ?? [];
    if (!calls.length) return { reply: (m.content ?? "").trim() || "Feito.", actions };
    convo.push({ role: "assistant", content: m.content ?? "", tool_calls: calls });
    for (const c of calls) {
      actions.push(c.function.name);
      let out: unknown;
      try { out = await ownerTool(sb, a, c.function.name, c.function.arguments ?? {}, origin); } catch (e) { out = { erro: e instanceof Error ? e.message : "falha" }; }
      convo.push({ role: "tool", tool_name: c.function.name, content: JSON.stringify(out).slice(0, 12000) });
    }
  }
  return { reply: "Executei várias etapas mas não concluí. Pode detalhar?", actions };
}

/** Resposta a um cliente no WhatsApp, seguindo roteiro, estilo e áudios. */
export async function agentClientReply(sb: SupabaseClient, a: Agent, fallbackKey: string, phone: string, contactName: string) {
  const { data } = await sb.from("agent_messages").select("direction,body").eq("agent_id", a.id).eq("phone", phone).order("created_at", { ascending: false }).limit(24);
  const hist = (data ?? []).reverse().map((m: any) => ({ role: m.direction === "in" ? "user" : "assistant", content: m.body }));
  const outs = hist.filter((h) => h.role === "assistant").length;
  const { data: auds } = await sb.from("agent_audios").select("id,title,trigger").eq("agent_id", a.id);
  const audios = (auds ?? []) as Array<{ id: string; title: string; trigger: string }>;
  const tone = await scriptsTone(sb, a.user_id);
  const sys = `${brief(a)}
Você está no WhatsApp com ${contactName || "um cliente"}, como se fosse o próprio Antonio digitando no celular. Já foram ${outs} mensagens suas nesta conversa — descubra em que etapa do roteiro vocês estão e avance só uma etapa por vez.
JEITO DE FALAR (obrigatório):
- Mensagens curtas como no celular. Se precisar de mais de uma ideia, separe em até 3 balões usando uma linha em branco entre eles.
- Português falado do Brasil, informal na medida, sem formalidade de e-mail. Pode errar levemente a pontuação, sem exagero.
- Responda exatamente o que perguntaram e termine com no máximo UMA pergunta.
- Nunca se reapresente nem repita a abertura. Continue do histórico.
- PROIBIDO: "BatRadar", dizer que é assistente/IA/robô, "presença online", "visibilidade", "soluções", "alavancar", "transformação digital", listas com marcadores, textos de propaganda, emojis em toda frase.
- Não invente preço, prazo ou desconto; se perguntarem, diga que confirma e chame avisar_dono.
${audios.length ? `ÁUDIOS DISPONÍVEIS (prefira áudio quando o gatilho bater; aí responda com texto vazio ou bem curto):\n${audios.map((x) => `- id ${x.id}: "${x.title}" — enviar quando: ${x.trigger || x.title}`).join("\n")}` : ""}
${tone ? `TOM DOS SCRIPTS DO DONO (imite, não copie):\n${tone}` : ""}
${btxText(a)}
Quando o cliente demonstrar interesse real, pedir preço, quiser fechar ou pedir humano, chame avisar_dono (é silencioso: NUNCA diga ao cliente que vai encaminhar, passar pro Antonio ou chamar alguém).`;
  const convo: any[] = [{ role: "system", content: sys }, ...hist];
  let hot = false; let reason = ""; let audioId = ""; let fixed: string[] = [];
  const rules = a.btx?.rules ?? [];
  for (let i = 0; i < 3; i++) {
    const m = await llm(a, fallbackKey, convo, CLIENT_TOOLS);
    const calls = m.tool_calls ?? [];
    if (!calls.length) return { replies: fixed.length ? fixed : splitBubbles(m.content ?? ""), hot, reason, audioId };
    convo.push({ role: "assistant", content: m.content ?? "", tool_calls: calls });
    for (const c of calls) {
      if (c.function.name === "responder_btx") {
        const r = rules[Number(c.function.arguments?.["situacao"]) - 1];
        if (r) { const pick = pickVariant(r.variants); if (pick) fixed = splitBubbles(fillTemplate(pick, { name: contactName })); if (r.audio_id && audios.some((x) => x.id === r.audio_id)) audioId = r.audio_id; }
        if (fixed.length || audioId) return { replies: fixed, hot, reason, audioId };
      } else if (c.function.name === "enviar_audio") { const id = String(c.function.arguments?.["audio_id"] ?? ""); if (audios.some((x) => x.id === id)) audioId = id; }
      else { hot = true; reason = String(c.function.arguments?.["motivo"] ?? ""); }
      convo.push({ role: "tool", tool_name: c.function.name, content: "{\"ok\":true}" });
    }
  }
  return { replies: [] as string[], hot, reason, audioId };
}

export function pickVariant(v: string[], rnd = Math.random()) {
  const ok = (v ?? []).map((x) => x.trim()).filter(Boolean);
  return ok.length ? ok[Math.floor(rnd * ok.length)]! : "";
}

function btxText(a: Agent) {
  const b = a.btx ?? {}; const rules = (b.rules ?? []).filter((r) => r.when?.trim());
  if (!b.prompt?.trim() && !rules.length) return "";
  return `ROTEIRO B-T6X (PRIORIDADE MÁXIMA — siga à risca, não invente fora dele):
${b.prompt?.trim() ?? ""}
${rules.length ? "SITUAÇÕES COM RESPOSTA PRONTA (quando a fala do cliente combinar, chame responder_btx com o número, sem escrever texto):\n" + rules.map((r, i) => `${i + 1}. Quando: ${r.when}`).join("\n") : ""}`;
}

export function splitBubbles(t: string) {
  return t.trim().split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean).slice(0, 3);
}

const PACE: Record<string, [number, number]> = { rapido: [6, 15], equilibrado: [15, 40], calmo: [40, 85] };
export function paceDelayMs(pace: string | undefined, rnd = Math.random()) {
  const [lo, hi] = PACE[pace ?? ""] ?? PACE["equilibrado"]!;
  return Math.round((lo + (hi - lo) * rnd) * 1000);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fluxo humano: espera "lendo", junta mensagens seguidas do cliente, responde em balões/áudio. */
export async function humanReply(sb: SupabaseClient, a: Agent, key: string, instance: string, phone: string, name: string, inboundId: string) {
  const { data: paused } = await sb.from("agent_pauses").select("phone").eq("agent_id", a.id).eq("phone", phone).maybeSingle();
  if (paused) return { skipped: "pausado" };
  await sleep(paceDelayMs(a.pace));
  const { data: last } = await sb.from("agent_messages").select("id,direction,manual").eq("agent_id", a.id).eq("phone", phone).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (last && (last as any).id !== inboundId) return { skipped: "nova mensagem ou dono respondeu" };
  const r = await agentClientReply(sb, a, key, phone, name);
  const { evoSend, evoSendAudio } = await import("@/lib/evolution.server");
  if (r.replies.length) {
    await evoSend(instance, phone, r.replies);
    for (const b of r.replies) await sb.from("agent_messages").insert({ user_id: a.user_id, agent_id: a.id, phone, contact_name: name, direction: "out", body: b, hot: r.hot });
  }
  if (r.audioId) {
    const { data: au } = await sb.from("agent_audios").select("title,data").eq("id", r.audioId).single();
    if (au) {
      await evoSendAudio(instance, phone, (au as any).data, 3000 + Math.random() * 5000);
      await sb.from("agent_messages").insert({ user_id: a.user_id, agent_id: a.id, phone, contact_name: name, direction: "out", body: `🎤 [áudio: ${(au as any).title}]`, hot: r.hot });
    }
  }
  await logEvent(sb, a, "resposta", `Respondeu ${name || phone}${r.audioId ? " com áudio" : ""}`);
  if (r.hot) await sb.from("agent_leads").update({ status: "quente" }).eq("agent_id", a.id).like("phone", `%${phone.slice(-8)}%`);
  else await sb.from("agent_leads").update({ status: "respondeu" }).eq("agent_id", a.id).like("phone", `%${phone.slice(-8)}%`).in("status", ["abordado", "novo"]);
  return r;
}

export function fillTemplate(t: string, l: { name?: string | null; city?: string | null; niche?: string | null }) {
  const first = (l.name ?? "").split(/[-|–]/)[0]!.trim();
  return t.replace(/\{nome\}/gi, first).replace(/\{cidade\}/gi, l.city ?? "").replace(/\{nicho\}/gi, l.niche ?? "");
}

/** Minerador próprio do agente: carteira separada dos leads do dono. */
export async function mineForAgent(sb: SupabaseClient, a: Agent, o: { niche?: unknown; city?: unknown; limit?: unknown } = {}) {
  const m = (a.miner ?? {}) as Miner;
  const niche = String(o.niche || m.niche || "").trim(), city = String(o.city || m.city || "").trim();
  if (!niche || !city) return { erro: "Configure nicho e cidade no minerador do agente." };
  const limit = Math.max(1, Math.min(60, Number(o.limit) || m.daily || 15));
  await logEvent(sb, a, "minerando", `Procurando ${niche} em ${city}…`);
  const { places } = await import("@/lib/jarvis.server");
  let found = (await places(niche, city, m.nota_minima ?? 0)).filter((x) => x.phone);
  if (m.sem_site) found = found.filter((x) => !x.website || /instagram|wa\.me|whatsapp|facebook|linktr/i.test(x.website));
  const before = found.length;
  found = found.filter((x) => x.open && x.reviews_count >= (m.min_reviews ?? 0) && x.photos >= (m.min_photos ?? 0));
  const weak = before - found.length;
  const ids = found.map((x) => x.place_id);
  const [{ data: mine }, { data: owner }] = await Promise.all([
    sb.from("agent_leads").select("place_id").eq("agent_id", a.id).in("place_id", ids),
    sb.from("leads").select("place_id").eq("user_id", a.user_id).in("place_id", ids),
  ]);
  const skip = new Set([...(mine ?? []), ...(owner ?? [])].map((x: any) => x.place_id));
  let fresh = found.filter((x) => !skip.has(x.place_id));
  let withSite = 0;
  if (m.sem_site && m.web_scan) {
    const keep: typeof fresh = [];
    for (const x of fresh) { if (keep.length >= limit) break; if (await hasOwnSite(x.name, x.city ?? city)) withSite++; else keep.push(x); }
    fresh = keep;
  }
  fresh = fresh.slice(0, limit);
  if (weak || withSite) await logEvent(sb, a, "filtrou", `Descartou ${weak} perfis fracos (poucas fotos/avaliações ou fechados)${withSite ? ` e ${withSite} que já têm site na internet` : ""}`);
  const steps = Array.isArray(a.script_steps) ? a.script_steps : [];
  const approach = !!m.auto_approach && !!a.instance && !!steps[0]?.message;
  let t = Date.now() + 2 * 60000;
  const rows = fresh.map(({ photos: _p, open: _o, ...x }) => { t += (6 + Math.random() * 9) * 60000; return { ...x, user_id: a.user_id, agent_id: a.id, status: approach ? "fila" : "novo", send_at: approach ? new Date(t).toISOString() : null }; });
  if (rows.length) await sb.from("agent_leads").insert(rows);
  await logEvent(sb, a, "minerou", `Encontrou ${rows.length} empresas novas (${niche}, ${city})${approach ? " e agendou a abordagem" : ""}`);
  return { novas: rows.length, abordagem_agendada: approach };
}

const inWindow = (m: Miner = {}, d = new Date()) => { const h = (d.getUTCHours() + 19) % 24; const wd = new Date(d.getTime() - 5 * 3600000).getUTCDay(); return h >= (m.hora_inicio ?? 8) && h < (m.hora_fim ?? 18) && wd !== 0; };

/** Varredura simples: procura domínio próprio (.com.br/.com) com o nome da empresa. */
export function siteGuesses(name: string) {
  const base = name.split(/[-|–(]/)[0]!.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return base.length < 4 ? [] : [`${base}.com.br`, `${base}.com`];
}
async function hasOwnSite(name: string, city: string) {
  for (const d of siteGuesses(name)) {
    try {
      const r = await fetch(`https://${d}`, { signal: AbortSignal.timeout(4000), redirect: "follow" });
      if (!r.ok) continue;
      const html = (await r.text()).slice(0, 60000).toLowerCase();
      const word = name.toLowerCase().split(/\s+/).find((w) => w.length > 3) ?? "";
      if (/parked|domain is for sale|registro\.br|hostgator.*em breve|godaddy/i.test(html)) continue;
      if (word && html.includes(word)) return true;
      if (city && html.includes(city.toLowerCase())) return true;
    } catch { /* sem site */ }
  }
  return false;
}

/** Envia as abordagens agendadas dos agentes (chamado pelo agendador). */
export async function processAgentQueue(sb: SupabaseClient) {
  const today = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10) + "T05:00:00Z";
  const sentToday = new Map<string, number>();
  const { data: due } = await sb.from("agent_leads").select("*").eq("status", "fila").lte("send_at", new Date().toISOString()).order("send_at").limit(8);
  let sent = 0;
  for (const l of (due ?? []) as any[]) {
    const { data: ag0 } = await sb.from("agents").select("miner").eq("id", l.agent_id).single();
    const m0 = ((ag0 as any)?.miner ?? {}) as Miner;
    if (!inWindow(m0)) continue;
    if (!sentToday.has(l.agent_id)) { const { count } = await sb.from("agent_events").select("id", { count: "exact", head: true }).eq("agent_id", l.agent_id).eq("kind", "abordou").gte("created_at", today); sentToday.set(l.agent_id, count ?? 0); }
    if (sentToday.get(l.agent_id)! >= (m0.limite_dia ?? 30)) continue;
    sentToday.set(l.agent_id, sentToday.get(l.agent_id)! + 1);
    const { data: got } = await sb.from("agent_leads").update({ status: "enviando" }).eq("id", l.id).eq("status", "fila").select("id");
    if (!got?.length) continue;
    const { data: a } = await sb.from("agents").select("*").eq("id", l.agent_id).single();
    const ag = a as any as Agent | null;
    const step = ag?.script_steps?.[0]?.message;
    if (!ag || !ag.active || !ag.instance || !step) { await sb.from("agent_leads").update({ status: "novo", send_at: null }).eq("id", l.id); continue; }
    try {
      const { evoSend } = await import("@/lib/evolution.server");
      const texts = splitBubbles(fillTemplate(step, l));
      await evoSend(ag.instance, l.phone, texts);
      const phone = digits(l.phone);
      for (const b of texts) await sb.from("agent_messages").insert({ user_id: ag.user_id, agent_id: ag.id, phone, contact_name: l.name, direction: "out", body: b });
      await sb.from("agent_leads").update({ status: "abordado" }).eq("id", l.id);
      await logEvent(sb, ag, "abordou", `Mandou abordagem para ${l.name}`);
      sent++;
    } catch (e) {
      await sb.from("agent_leads").update({ status: "erro" }).eq("id", l.id);
      await logEvent(sb, ag, "erro", `Falhou com ${l.name}: ${e instanceof Error ? e.message : "erro"}`);
    }
  }
  return sent;
}
