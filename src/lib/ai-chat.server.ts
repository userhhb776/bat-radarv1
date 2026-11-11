// Cliente único de IA: recebe o pedido no formato Ollama (/api/chat) e tenta, em cascata:
// texto  -> Groq (rápido) -> DeepSeek (reserva) -> Ollama
// imagem -> Gemini (visão) -> Ollama
// Todos falam o formato OpenAI; a resposta volta convertida para o formato Ollama.

async function cfg(key: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any).from("service_config").select("value").eq("key", key).maybeSingle();
    if (data?.value) return String(data.value);
  } catch { /* usa segredo */ }
  return process.env[key] || "";
}

export const PROVIDERS = {
  groq: { url: "https://api.groq.com/openai/v1/chat/completions", model: "openai/gpt-oss-120b", key: "GROQ_API_KEY" },
  deepseek: { url: "https://api.deepseek.com/chat/completions", model: "deepseek-chat", key: "DEEPSEEK_API_KEY" },
  gemini: { url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "gemini-3.8-flash", key: "GEMINI_API_KEY" },
} as const;
type Prov = keyof typeof PROVIDERS;

export function toOpenAIBody(body: any, model = "deepseek-chat") {
  const messages: any[] = [];
  const pending: string[] = [];
  let n = 0;
  for (const m of body.messages ?? []) {
    if (m.role === "assistant" && m.tool_calls?.length) {
      const calls = m.tool_calls.map((c: any) => {
        const id = `call_${n++}`;
        pending.push(id);
        const args = c.function?.arguments;
        return { id, type: "function", function: { name: c.function?.name, arguments: typeof args === "string" ? args : JSON.stringify(args ?? {}) } };
      });
      messages.push({ role: "assistant", content: m.content ?? "", tool_calls: calls });
    } else if (m.role === "tool") {
      messages.push({ role: "tool", tool_call_id: pending.shift() ?? `call_${n++}`, content: String(m.content ?? "") });
    } else if (m.images?.length) {
      messages.push({ role: m.role, content: [
        { type: "text", text: String(m.content ?? "") },
        ...m.images.map((b: string) => ({ type: "image_url", image_url: { url: b.startsWith("data:") ? b : `data:image/jpeg;base64,${b}` } })),
      ] });
    } else {
      messages.push({ role: m.role, content: String(m.content ?? "") });
    }
  }
  const out: any = { model, stream: false, messages };
  if (body.tools?.length) out.tools = body.tools;
  if (body.format) {
    out.response_format = { type: "json_object" };
    const schema = typeof body.format === "object" ? `\nFormato JSON exigido (schema): ${JSON.stringify(body.format)}` : "";
    messages.unshift({ role: "system", content: `Responda somente com um objeto JSON válido.${schema}` });
  }
  if (body.options?.temperature !== undefined) out.temperature = body.options.temperature;
  return out;
}
export const toDeepseekBody = (body: any) => toOpenAIBody(body, "deepseek-chat");

export function fromDeepseek(j: any) {
  const msg = j?.choices?.[0]?.message ?? {};
  const tool_calls = (msg.tool_calls ?? []).map((c: any) => {
    let args: unknown = {};
    try { args = JSON.parse(c.function?.arguments || "{}"); } catch { args = {}; }
    return { function: { name: c.function?.name, arguments: args } };
  });
  return { message: { role: "assistant", content: msg.content ?? "", ...(tool_calls.length ? { tool_calls } : {}) }, done: true };
}

// Guarda o último consumo informado pelo Groq (cabeçalhos de limite) e contagem diária por provedor.
async function recordUsage(p: Prov, res: Response | null, ok: boolean) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const key = `AI_USAGE_${p.toUpperCase()}`;
    const { data } = await (supabaseAdmin as any).from("service_config").select("value").eq("key", key).maybeSingle();
    let u: any = {};
    try { u = JSON.parse(data?.value || "{}"); } catch { u = {}; }
    const day = new Date().toISOString().slice(0, 10);
    if (u.day !== day) u = { day, calls: 0, fails: 0 };
    u.calls++; if (!ok) u.fails++;
    u.last = new Date().toISOString();
    u.lastStatus = res?.status ?? 0;
    const h = res?.headers;
    if (h?.get("x-ratelimit-limit-requests")) {
      u.rl = {
        reqLimit: Number(h.get("x-ratelimit-limit-requests")), reqLeft: Number(h.get("x-ratelimit-remaining-requests")),
        tokLimit: Number(h.get("x-ratelimit-limit-tokens")), tokLeft: Number(h.get("x-ratelimit-remaining-tokens")),
        reqReset: h.get("x-ratelimit-reset-requests"),
      };
    }
    await (supabaseAdmin as any).from("service_config").upsert({ key, value: JSON.stringify(u), updated_at: new Date().toISOString() });
  } catch { /* uso é só informativo */ }
}

async function callProvider(p: Prov, body: any, signal?: AbortSignal | null): Promise<Response | null> {
  const P = PROVIDERS[p];
  const key = await cfg(P.key);
  if (!key) return null;
  let res: Response | null = null;
  try {
    res = await fetch(P.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(toOpenAIBody(body, P.model)),
      signal: signal ?? AbortSignal.timeout(p === "gemini" ? 45000 : 25000),
    });
  } catch (e) {
    console.error(p, "sem resposta", String(e).slice(0, 120));
    await recordUsage(p, null, false);
    return null;
  }
  await recordUsage(p, res, res.ok);
  if (!res.ok) { console.error(p, res.status, (await res.text()).slice(0, 300)); return null; }
  return new Response(JSON.stringify(fromDeepseek(await res.json())), { status: 200, headers: { "Content-Type": "application/json" } });
}

export async function aiFetch(url: string, init: RequestInit): Promise<Response> {
  let body: any = null;
  try { body = JSON.parse(String(init.body ?? "")); } catch { body = null; }
  if (!body) return fetch(url, init);
  const hasImages = !!body.messages?.some((m: any) => m.images?.length);
  const chain: Prov[] = hasImages ? ["gemini"] : ["groq", "deepseek"];
  for (const p of chain) {
    const r = await callProvider(p, body, init.signal);
    if (r) return r;
  }
  return fetch(url, init); // último recurso: Ollama
}
