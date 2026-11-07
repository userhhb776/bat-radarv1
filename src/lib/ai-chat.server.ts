// Cliente único de IA: recebe o pedido no formato Ollama (/api/chat). Se houver chave DeepSeek
// configurada (e o pedido não tiver imagens), traduz para DeepSeek e devolve no formato Ollama.
async function deepseekKey() {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any).from("service_config").select("value").eq("key", "DEEPSEEK_API_KEY").maybeSingle();
    if (data?.value) return String(data.value);
  } catch { /* usa segredo */ }
  return process.env["DEEPSEEK_API_KEY"] || "";
}

export function toDeepseekBody(body: any) {
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
    } else {
      messages.push({ role: m.role, content: String(m.content ?? "") });
    }
  }
  const out: any = { model: "deepseek-chat", stream: false, messages };
  if (body.tools?.length) out.tools = body.tools;
  if (body.format) {
    out.response_format = { type: "json_object" };
    const schema = typeof body.format === "object" ? `\nFormato JSON exigido (schema): ${JSON.stringify(body.format)}` : "";
    messages.unshift({ role: "system", content: `Responda somente com um objeto JSON válido.${schema}` });
  }
  if (body.options?.temperature !== undefined) out.temperature = body.options.temperature;
  return out;
}

export function fromDeepseek(j: any) {
  const msg = j?.choices?.[0]?.message ?? {};
  const tool_calls = (msg.tool_calls ?? []).map((c: any) => {
    let args: unknown = {};
    try { args = JSON.parse(c.function?.arguments || "{}"); } catch { args = {}; }
    return { function: { name: c.function?.name, arguments: args } };
  });
  return { message: { role: "assistant", content: msg.content ?? "", ...(tool_calls.length ? { tool_calls } : {}) }, done: true };
}

export async function aiFetch(url: string, init: RequestInit): Promise<Response> {
  const key = await deepseekKey();
  let body: any = null;
  try { body = JSON.parse(String(init.body ?? "")); } catch { body = null; }
  const hasImages = !!body?.messages?.some((m: any) => m.images?.length);
  if (!key || !body || hasImages) return fetch(url, init);
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(toDeepseekBody(body)),
    ...(init.signal ? { signal: init.signal } : {}),
  });
  if (!res.ok) {
    console.error("deepseek", res.status, (await res.text()).slice(0, 300));
    if (res.status === 402 || res.status === 401) return fetch(url, init); // sem saldo/chave ruim: volta pro Ollama
    return new Response(null, { status: res.status });
  }
  return new Response(JSON.stringify(fromDeepseek(await res.json())), { status: 200, headers: { "Content-Type": "application/json" } });
}
