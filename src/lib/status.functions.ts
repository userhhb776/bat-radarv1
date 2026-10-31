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

const mask = (s: string) => (s ? `${s.slice(0, 4)}•••${s.slice(-3)}` : "");

export const getSystemStatus = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { getEvo, getOllamaKey } = await import("@/lib/service-config.server");
    const evo = await getEvo();
    const ollamaKey = await getOllamaKey();
    const [dbRes, evoStatus, ollama] = await Promise.all([
      context.supabase.rpc("db_usage" as any),
      pingEvo(evo.base, evo.key),
      pingOllama(ollamaKey),
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
      .eq("kind", "argos").gte("created_at", monthStart.toISOString());

    return {
      db: { bytes: db.bytes, limit: DB_LIMIT_BYTES, tables: db.tables ?? [] },
      render: {
        url: evo.base, keyMask: mask(evo.key), fromPanel: evo.fromPanel, ...evoStatus,
        hoursUsed, hoursLimit: RENDER_FREE_HOURS, daysToReset, resetOn: nextMonth.toISOString(),
      },
      ai: { keyMask: mask(ollamaKey), uses: argosCount ?? 0, ...ollama },
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
  .inputValidator((d: unknown) => z.object({ key: z.string().trim().min(10).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const test = await pingOllama(data.key);
    if (!test.ok) throw new Error(`A nova chave não funcionou: ${test.error}. Nada foi trocado.`);
    await save({ OLLAMA_API_KEY: data.key });
    return { ok: true };
  });
