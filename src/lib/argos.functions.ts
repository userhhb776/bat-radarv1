import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireApprovedAccount } from "@/lib/access.middleware";

// Argos: assistente próprio do painel, rodando no Ollama Cloud com a chave OLLAMA_API_KEY.
// Executa as mesmas ações do antigo Jarvis (jarvis.server), sempre com o cliente RLS do usuário.
const MODEL = "gpt-oss:120b";

const TOOLS: Array<{ name: string; description: string; properties: Record<string, unknown>; required?: string[] }> = [
  { name: "resumo", description: "Números gerais: leads no pipeline, mensagens pendentes e enviadas.", properties: {} },
  { name: "listar_blocos", description: "Lista os blocos de leads (id, nome, nicho, nº de empresas).", properties: {} },
  { name: "listar_scripts", description: "Lista scripts de abordagem (id, título).", properties: {} },
  { name: "listar_instancias", description: "Lista os números de WhatsApp disponíveis e se estão conectados.", properties: {} },
  { name: "listar_campanhas", description: "Lista campanhas com enviadas/pendentes/falhas.", properties: {} },
  { name: "buscar_leads", description: "Busca empresas no Google Maps (não salva).", properties: { nicho: { type: "string" }, cidade: { type: "string" }, nota_minima: { type: "number" }, sem_site: { type: "boolean" } }, required: ["nicho", "cidade"] },
  { name: "criar_bloco", description: "Cria um bloco de leads vazio.", properties: { nome: { type: "string" }, nicho: { type: "string" } }, required: ["nome"] },
  { name: "buscar_e_salvar", description: "Busca empresas no Google Maps e salva num bloco (cria o bloco se bloco_id vazio).", properties: { nicho: { type: "string" }, cidade: { type: "string" }, limite: { type: "number" }, sem_site: { type: "boolean" }, nota_minima: { type: "number" }, bloco_id: { type: "string" }, nome_bloco: { type: "string" } }, required: ["nicho", "cidade"] },
  { name: "status_campanha", description: "Pausa ou ativa uma campanha.", properties: { campanha_id: { type: "string" }, status: { type: "string", enum: ["ativa", "pausada"] } }, required: ["campanha_id", "status"] },
  { name: "criar_campanha", description: "Cria campanha de WhatsApp para um bloco com um script e um número. Horários no fuso do usuário (Rio Branco).", properties: { nome: { type: "string" }, bloco_id: { type: "string" }, script_id: { type: "string" }, instancia: { type: "string" }, comecar_agora: { type: "boolean" }, inicio: { type: "string", description: "ISO, ex 2026-10-27T09:00:00-05:00" }, hora_inicio: { type: "number" }, hora_fim: { type: "number" }, limite_diario: { type: "number" }, dias: { type: "array", items: { type: "number" } } }, required: ["bloco_id", "script_id", "instancia"] },
  { name: "listar_agentes", description: "Lista os AGENTES de vendas (id, nome, ativo, número, missão).", properties: {} },
  { name: "criar_agente", description: "Cria um AGENTE de vendas automático (não é campanha). Pode já definir missão, oferta, cliente ideal, regras, jeito de falar, nicho/cidade do minerador e o prompt B-T6X.", properties: { nome: { type: "string" }, missao: { type: "string" }, oferta: { type: "string" }, cliente_ideal: { type: "string" }, regras: { type: "string" }, estilo: { type: "string" }, instancia: { type: "string" }, nicho: { type: "string" }, cidade: { type: "string" }, btx_prompt: { type: "string" } }, required: ["nome"] },
  { name: "configurar_agente", description: "Altera um agente existente (só os campos enviados). ativo liga/desliga; auto_resposta liga/desliga respostas.", properties: { agente_id: { type: "string" }, nome: { type: "string" }, missao: { type: "string" }, oferta: { type: "string" }, cliente_ideal: { type: "string" }, regras: { type: "string" }, estilo: { type: "string" }, instancia: { type: "string" }, ativo: { type: "boolean" }, auto_resposta: { type: "boolean" }, btx_prompt: { type: "string" } }, required: ["agente_id"] },
  { name: "metricas_agentes", description: "Desempenho de cada agente: abordados, responderam, taxa de resposta, fila e erros.", properties: {} },
  { name: "minerar_agente", description: "Manda um agente minerar empresas agora (usa nicho/estados dele se não informar).", properties: { agente_id: { type: "string" }, nicho: { type: "string" }, limite: { type: "number" } }, required: ["agente_id"] },
];

async function agentAction(sb: any, userId: string, name: string, p: Record<string, any>) {
  if (name === "listar_agentes") {
    const { data } = await sb.from("agents").select("id,name,active,auto_reply,instance,mission").order("created_at");
    return data ?? [];
  }
  if (name === "metricas_agentes") {
    const [{ data: ags }, { data: ls }, { data: ins }] = await Promise.all([
      sb.from("agents").select("id,name,active,squad"),
      sb.from("agent_leads").select("agent_id,status"),
      sb.from("agent_messages").select("agent_id,phone").eq("direction", "in"),
    ]);
    return (ags ?? []).map((g: any) => {
      const mine = (ls ?? []).filter((l: any) => l.agent_id === g.id);
      const ab = mine.filter((l: any) => l.status === "abordado").length;
      const resp = new Set((ins ?? []).filter((m: any) => m.agent_id === g.id).map((m: any) => m.phone)).size;
      return { agente: g.name, aba: g.squad ?? "agentes", ativo: g.active, abordados: ab, responderam: resp, taxa: ab ? Math.round((resp / ab) * 100) + "%" : "-", fila: mine.filter((l: any) => l.status === "fila").length, erros: mine.filter((l: any) => l.status === "erro" || l.status === "revisao").length };
    });
  }
  if (name === "minerar_agente") {
    const { data: ag } = await sb.from("agents").select("*").eq("id", p["agente_id"]).maybeSingle();
    if (!ag) return { erro: "Agente não encontrado." };
    const { mineForAgent } = await import("@/lib/agents.server");
    return await mineForAgent(sb, ag, { niche: p["nicho"], limit: p["limite"] });
  }
  const map: Record<string, string> = { nome: "name", missao: "mission", oferta: "offer", cliente_ideal: "ideal_client", regras: "rules", estilo: "style", instancia: "instance", ativo: "active", auto_resposta: "auto_reply" };
  const row: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(map)) if (p[k] !== undefined && p[k] !== "") row[col] = typeof p[k] === "string" ? String(p[k]).slice(0, 4000) : p[k];
  if (p["btx_prompt"]) row["btx"] = { prompt: String(p["btx_prompt"]).slice(0, 8000), rules: [] };
  if (name === "criar_agente") {
    if (p["nicho"] || p["cidade"]) row["miner"] = { niche: p["nicho"] ?? "", city: p["cidade"] ?? "", daily: 15 };
    const { data, error } = await sb.from("agents").insert({ ...row, user_id: userId, active: false }).select("id,name").single();
    if (error) return { erro: error.message };
    return { ok: true, id: data.id, aviso: "Criado desligado. Abra /agentes/" + data.id + " para revisar e ligar." };
  }
  const { data: cur } = await sb.from("agents").select("btx").eq("id", p["agente_id"]).maybeSingle();
  if (!cur) return { erro: "Agente não encontrado." };
  if (row["btx"]) row["btx"] = { ...(cur.btx ?? {}), prompt: (row["btx"] as any).prompt };
  const { error } = await sb.from("agents").update(row).eq("id", p["agente_id"]);
  return error ? { erro: error.message } : { ok: true };
}

const SYSTEM = `Você é ARGOS, a inteligência própria do painel BatRadar do Antonio. Fala como o Jarvis do Homem de Ferro: educado, confiante, levemente espirituoso, chamando-o de "senhor" às vezes.
Você tem acesso total ao painel: lê, analisa, cria, edita e comanda tudo pelas ferramentas. Para análise de agentes use metricas_agentes. Ações destrutivas (apagar, disparar em massa) só com pedido explícito.
AGENTE ≠ CAMPANHA: quando pedirem um "agente", use criar_agente/configurar_agente/listar_agentes — nunca crie bloco ou campanha para isso.
Regras: respostas CURTAS e precisas (1-3 frases), português do Brasil. Quando pedirem algo, EXECUTE usando as ferramentas — não peça confirmação para leituras ou buscas. Para criar campanhas, descubra ids com listar_blocos/listar_scripts/listar_instancias antes. Nunca invente ids ou números. Se faltar um dado essencial, pergunte em uma frase. Hoje é ${"{HOJE}"}.`;

export const argosChat = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) })).min(1).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const key = await (await import("@/lib/service-config.server")).getOllamaKey();
    await context.supabase.rpc("record_access", { _kind: "page", _page: "/argos-chat", _detail: {} });
    if (!key) throw new Error("Chave do Ollama não configurada.");
    const { runAction } = await import("@/lib/jarvis.server");
    const { getRequest } = await import("@tanstack/react-start/server");
    const origin = new URL(getRequest().url).origin;
    const convo: any[] = [{ role: "system", content: SYSTEM.replace("{HOJE}", new Date().toLocaleString("pt-BR", { timeZone: "America/Rio_Branco" })) }, ...data.messages];
    const actions: string[] = [];
    for (let step = 0; step < 8; step++) {
      const res = await fetch("https://ollama.com/api/chat", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, stream: false, messages: convo, tools: TOOLS.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: { type: "object", properties: t.properties, required: t.required ?? [] } } })) }),
      });
      if (!res.ok) throw new Error(res.status === 401 ? "Chave do Ollama inválida." : res.status === 429 ? "Limite do Ollama atingido. Aguarde um pouco." : `Ollama respondeu ${res.status}.`);
      const j = (await res.json()) as { message?: { content?: string; tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }> } };
      const m = j.message ?? {};
      const calls = m.tool_calls ?? [];
      if (!calls.length) return { reply: (m.content ?? "").trim() || "Feito, senhor.", actions };
      convo.push({ role: "assistant", content: m.content ?? "", tool_calls: calls });
      for (const c of calls) {
        const name = c.function.name; actions.push(name);
        let out: unknown;
        try { out = /agente/.test(name) ? await agentAction(context.supabase, context.userId, name, c.function.arguments ?? {}) : await runAction(context.supabase as any, context.userId, name, c.function.arguments ?? {}, origin); }
        catch (e) { out = { erro: e instanceof Error ? e.message : "falha" }; }
        convo.push({ role: "tool", tool_name: name, content: JSON.stringify(out).slice(0, 12000) });
      }
    }
    return { reply: "Executei várias etapas, senhor, mas não concluí. Pode detalhar o pedido?", actions };
  });
