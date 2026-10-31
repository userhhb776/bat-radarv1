import type { SupabaseClient } from "@supabase/supabase-js";

// Cérebro dos agentes: um só motor para (1) responder clientes no WhatsApp,
// (2) receber ordens do dono no modo treinamento e (3) conversar pelo painel.
export type Agent = {
  id: string; user_id: string; name: string; mission: string; offer: string; rules: string; ideal_client: string;
  learned: string; instance: string; ai_provider: string; ai_key: string | null; model: string;
  active: boolean; auto_reply: boolean; training_mode: boolean; training_phone: string;
};

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
  { name: "enviar_mensagem", description: "Envia uma mensagem de WhatsApp para um telefone pelo número do agente.", properties: { telefone: { type: "string" }, texto: { type: "string" } }, required: ["telefone", "texto"] },
];

const CLIENT_TOOLS: Tool[] = [
  { name: "avisar_dono", description: "Avisa o dono que este cliente está quente / quer fechar / pediu humano.", properties: { motivo: { type: "string" } }, required: ["motivo"] },
];

function brief(a: Agent) {
  return `Você é ${a.name}, agente de vendas que trabalha para o Antonio.
MISSÃO: ${a.mission || "prospectar e conversar com empresas"}
O QUE VENDE (adapte-se, não é sempre site): ${a.offer || "pergunte ao dono"}
CLIENTE IDEAL: ${a.ideal_client || "não definido"}
REGRAS RÍGIDAS DO DONO (siga sempre): ${a.rules || "nenhuma"}
APRENDIZADOS: ${a.learned || "nenhum"}
Hoje: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Rio_Branco" })}.`;
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
  const { runAction } = await import("@/lib/jarvis.server");
  return runAction(sb, a.user_id, name, p, origin);
}

/** Conversa com o dono (painel ou WhatsApp em modo treinamento): controle total do painel. */
export async function agentOwnerChat(sb: SupabaseClient, a: Agent, fallbackKey: string, history: Array<{ role: string; content: string }>, origin: string) {
  const sys = `${brief(a)}
Você está falando com o SEU DONO. Obedeça ordens e execute com as ferramentas, sem pedir confirmação para leituras. Quando ele ensinar algo novo (preferência, tipo de empresa, regra), use "aprender". Respostas curtas e precisas, como o Jarvis. Nunca invente dados.`;
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

/** Resposta a um cliente no WhatsApp, seguindo o treinamento. Retorna o texto e se é lead quente. */
export async function agentClientReply(sb: SupabaseClient, a: Agent, fallbackKey: string, phone: string, contactName: string) {
  const { data } = await sb.from("agent_messages").select("direction,body").eq("agent_id", a.id).eq("phone", phone).order("created_at", { ascending: false }).limit(20);
  const hist = (data ?? []).reverse().map((m: any) => ({ role: m.direction === "in" ? "user" : "assistant", content: m.body }));
  const sys = `${brief(a)}
Você está conversando pelo WhatsApp com ${contactName || "um cliente"}. Escreva como uma pessoa real: mensagens curtas, naturais, sem listas, sem parecer robô, sem dizer que é IA. Siga as regras do dono à risca. Seu objetivo é levar o cliente até o fechamento; quando ele demonstrar interesse real, pedir preço final, quiser fechar ou pedir para falar com alguém, chame avisar_dono.`;
  const convo: any[] = [{ role: "system", content: sys }, ...hist];
  let hot = false; let reason = "";
  for (let i = 0; i < 3; i++) {
    const m = await llm(a, fallbackKey, convo, CLIENT_TOOLS);
    const calls = m.tool_calls ?? [];
    if (!calls.length) return { reply: (m.content ?? "").trim(), hot, reason };
    convo.push({ role: "assistant", content: m.content ?? "", tool_calls: calls });
    for (const c of calls) { hot = true; reason = String(c.function.arguments?.["motivo"] ?? ""); convo.push({ role: "tool", tool_name: c.function.name, content: "{\"ok\":true}" }); }
  }
  return { reply: "", hot, reason };
}
