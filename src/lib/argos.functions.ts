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
];

const SYSTEM = `Você é ARGOS, a inteligência própria do painel BatRadar do Antonio. Fala como o Jarvis do Homem de Ferro: educado, confiante, levemente espirituoso, chamando-o de "senhor" às vezes.
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
        try { out = await runAction(context.supabase as any, context.userId, name, c.function.arguments ?? {}, origin); }
        catch (e) { out = { erro: e instanceof Error ? e.message : "falha" }; }
        convo.push({ role: "tool", tool_name: name, content: JSON.stringify(out).slice(0, 12000) });
      }
    }
    return { reply: "Executei várias etapas, senhor, mas não concluí. Pode detalhar o pedido?", actions };
  });
