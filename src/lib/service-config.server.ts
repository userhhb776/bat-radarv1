// Endereço/chave do servidor WhatsApp e chave da IA: o valor trocado pelo painel (service_config)
// tem prioridade; sem ele, usa os segredos do projeto.
let cache: { at: number; map: Record<string, string> } | null = null;

async function load(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < 15000) return cache.map;
  const map: Record<string, string> = {};
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any).from("service_config").select("key,value");
    for (const r of data ?? []) map[r.key] = r.value;
  } catch (e) {
    console.error("service_config", e);
  }
  cache = { at: Date.now(), map };
  return map;
}

export function clearServiceConfigCache() { cache = null; }

export async function getEvo() {
  const m = await load();
  const base = (m["EVOLUTION_API_URL"] || process.env["EVOLUTION_API_URL"] || "").replace(/\/$/, "");
  const key = m["EVOLUTION_API_KEY"] || process.env["EVOLUTION_API_KEY"] || "";
  return { base, key, fromPanel: !!m["EVOLUTION_API_URL"] };
}

export async function getOllamaKey() {
  const m = await load();
  return m["OLLAMA_API_KEY"] || process.env["OLLAMA_API_KEY"] || "";
}
