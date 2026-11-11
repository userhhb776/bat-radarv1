import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireApprovedAccount } from "@/lib/access.middleware";

const DB_LIMIT_BYTES = 500 * 1024 * 1024; // plano gratuito do Supabase
const RENDER_FREE_HOURS = 750; // horas gratuitas por mês no Render (renova dia 1)

async function assertAdmin(context: any) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Apenas o administrador pode ver esta área.");
}

async function pingEvo(base: string, key: string) {
  if (!base || !key) return { ok: false, error: "Não configurado", ms: 0, instances: 0, connected: 0 };
  const t = Date.now();
  try {
    const r = await fetch(`${base}/instance/fetchInstances`, { headers: { apikey: key }, signal: AbortSignal.timeout(50000) });
    const ms = Date.now() - t;
    if (r.status === 401 || r.status === 403) return { ok: false, error: "Chave recusada pelo servidor", ms, instances: 0, connected: 0 };
    if (!r.ok) return { ok: false, error: `Servidor respondeu ${r.status}`, ms, instances: 0, connected: 0 };
    const list = (await r.json().catch(() => [])) as any[];
    const arr = Array.isArray(list) ? list : [];
    return { ok: true, error: null, ms, instances: arr.length, connected: arr.filter((i) => i?.connectionStatus === "open").length };
  } catch {
    return { ok: false, error: "Sem resposta (servidor dormindo ou fora do ar)", ms: Date.now() - t, instances: 0, connected: 0 };
  }
}

async function pingOllama(key: string) {
  if (!key) return { ok: false, error: "Não configurada", ms: 0 };
  const t = Date.now();
  try {
    const r = await fetch("https://ollama.com/api/chat", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-oss:120b", stream: false, messages: [{ role: "user", content: "ok" }], options: { num_predict: 1 } }),
      signal: AbortSignal.timeout(40000),
    });
    const ms = Date.now() - t;
    if (r.status === 401 || r.status === 403) return { ok: false, error: "Chave inválida", ms };
    if (r.status === 429) return { ok: false, error: "Limite atingido — troque a chave ou aguarde renovar", ms };
    if (!r.ok) return { ok: false, error: `Ollama respondeu ${r.status}`, ms };
    return { ok: true, error: null, ms };
  } catch {
    return { ok: false, error: "Sem resposta", ms: Date.now() - t };
  }
}

const AI_INFO = {
  groq: { name: "Groq", role: "Principal (WhatsApp, B-T6X, Argos)", limits: "Grátis: 1.000 pedidos/dia · 8.000 tokens/min" },
  deepseek: { name: "DeepSeek", role: "Reserva quando o Groq falhar", limits: "Pago por uso: ~US$0,28 por 1 milhão de tokens" },
  gemini: { name: "Gemini", role: "Leitura de prints (imagens)", limits: "Grátis com limite diário; às vezes fica lento/ocupado" },
  ollama: { name: "Ollama", role: "Último recurso", limits: "Plano gratuito encerrado" },
} as const;
type AiP = keyof typeof AI_INFO;

async function pingAi(p: AiP, key: string) {
  if (!key) return { ok: false, error: "Não configurada", ms: 0, balance: null as string | null, rl: null as any };
  if (p === "ollama") return { ...(await pingOllama(key)), balance: null, rl: null };
  const t = Date.now();
  try {
    if (p === "deepseek") {
      const r = await fetch("https://api.deepseek.com/user/balance", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) });
      const ms = Date.now() - t;
      if (!r.ok) return { ok: false, error: r.status === 401 ? "Chave inválida" : `Respondeu ${r.status}`, ms, balance: null, rl: null };
      const j: any = await r.json();
      const b = j?.balance_infos?.[0];
      return { ok: !!j?.is_available, error: j?.is_available ? null : "Sem saldo", ms, balance: b ? `${b.total_balance} ${b.currency}` : null, rl: null };
    }
    const { PROVIDERS } = await import("@/lib/ai-chat.server");
    const P = PROVIDERS[p];
    const r = await fetch(P.url, {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: P.model, messages: [{ role: "user", content: "ok" }], max_tokens: 1 }),
      signal: AbortSignal.timeout(p === "gemini" ? 30000 : 15000),
    });
    const ms = Date.now() - t;
    const h = r.headers;
    const rl = h.get("x-ratelimit-limit-requests") ? {
      reqLimit: Number(h.get("x-ratelimit-limit-requests")), reqLeft: Number(h.get("x-ratelimit-remaining-requests")),
      tokLimit: Number(h.get("x-ratelimit-limit-tokens")), tokLeft: Number(h.get("x-ratelimit-remaining-tokens")),
      reqReset: h.get("x-ratelimit-reset-requests"),
    } : null;
    if (r.status === 401 || r.status === 403) return { ok: false, error: "Chave inválida", ms, balance: null, rl };
    if (r.status === 429) return { ok: false, error: "Limite atingido — aguarde renovar ou troque a chave", ms, balance: null, rl };
    if (r.status === 503) return { ok: false, error: "Ocupado agora (alta demanda) — o sistema usa outra IA", ms, balance: null, rl };
    if (!r.ok) return { ok: false, error: `Respondeu ${r.status}`, ms, balance: null, rl };
    return { ok: true, error: null, ms, balance: null, rl };
  } catch {
    return { ok: false, error: "Sem resposta (lento)", ms: Date.now() - t, balance: null, rl: null };
  }
}

async function aiProviders() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any).from("service_config").select("key,value");
  const m: Record<string, string> = {};
  for (const r of data ?? []) m[r.key] = r.value;
  const keyOf = (p: AiP) => m[`${p.toUpperCase()}_API_KEY`] || process.env[`${p.toUpperCase()}_API_KEY`] || "";
  const today = new Date().toISOString().slice(0, 10);
  return Promise.all((Object.keys(AI_INFO) as AiP[]).map(async (p) => {
    const key = keyOf(p);
    let usage: any = null;
    try { usage = JSON.parse(m[`AI_USAGE_${p.toUpperCase()}`] || "null"); } catch { usage = null; }
    if (usage && usage.day !== today) usage = { ...usage, calls: 0, fails: 0 };
    const ping = await pingAi(p, key);
    return { id: p, ...AI_INFO[p], keyMask: mask(key), callsToday: usage?.calls ?? 0, failsToday: usage?.fails ?? 0, last: usage?.last ?? null, ...ping, rl: ping.rl ?? usage?.rl ?? null };
  }));
}

const mask = (s: string) => (s ? `${s.slice(0, 4)}•••${s.slice(-3)}` : "");

export const getSystemStatus = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { getEvo, getOllamaKey } = await import("@/lib/service-config.server");
    const evo = await getEvo();
    const ollamaKey = await getOllamaKey();
    const [dbRes, evoStatus, ollama, ais] = await Promise.all([
      context.supabase.rpc("db_usage" as any),
      pingEvo(evo.base, evo.key),
      pingOllama(ollamaKey),
      aiProviders(),
    ]);
    const db = (dbRes.data ?? { bytes: 0, tables: [] }) as { bytes: number; tables: { name: string; bytes: number; rows: number }[] };

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const hoursUsed = Math.round((now.getTime() - monthStart.getTime()) / 3600000);
    const daysToReset = Math.ceil((nextMonth.getTime() - now.getTime()) / 86400000);

    // uso da IA neste mês (conversas registradas no Argos)
    const { count: argosCount } = await context.supabase
      .from("access_events").select("id", { count: "exact", head: true })
      .eq("kind", "page").eq("page", "/argos-chat").gte("created_at", monthStart.toISOString());

    return {
      db: { bytes: db.bytes, limit: DB_LIMIT_BYTES, tables: db.tables ?? [] },
      render: {
        url: evo.base, keyMask: mask(evo.key), fromPanel: evo.fromPanel, ...evoStatus,
        hoursUsed, hoursLimit: RENDER_FREE_HOURS, daysToReset, resetOn: nextMonth.toISOString(),
      },
      ai: { keyMask: mask(ollamaKey), uses: argosCount ?? 0, ...ollama },
      ais,
    };
  });

async function save(entries: Record<string, string>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rows = Object.entries(entries).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }));
  const { error } = await (supabaseAdmin as any).from("service_config").upsert(rows);
  if (error) throw new Error("Não foi possível salvar.");
  (await import("@/lib/service-config.server")).clearServiceConfigCache();
}

export const saveRenderServer = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => z.object({ url: z.string().trim().url().max(300).refine((u) => /^https?:\/\//.test(u)), key: z.string().trim().min(4).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const base = data.url.replace(/\/$/, "");
    const test = await pingEvo(base, data.key);
    if (!test.ok) throw new Error(`O novo servidor não respondeu: ${test.error}. Nada foi trocado.`);
    await save({ EVOLUTION_API_URL: base, EVOLUTION_API_KEY: data.key });
    return { instances: test.instances, connected: test.connected };
  });

export const saveAiKey = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => z.object({ key: z.string().trim().min(10).max(500), provider: z.enum(["groq", "deepseek", "gemini", "ollama"]).default("ollama") }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const test = await pingAi(data.provider, data.key);
    if (!test.ok && test.error === "Chave inválida") throw new Error(`A nova chave não funcionou: ${test.error}. Nada foi trocado.`);
    await save({ [`${data.provider.toUpperCase()}_API_KEY`]: data.key });
    return { ok: true };
  });
