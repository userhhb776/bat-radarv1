import { normalizeBR } from "@/lib/phone";
import { createServerFn } from "@tanstack/react-start";
import { requireApprovedAccount as requireSupabaseAuth } from "@/lib/access.middleware";

// Each account owns Evolution instances prefixed with its id, so numbers never cross accounts.
const prefixFor = (userId: string) => `br${userId.replace(/-/g, "").slice(0, 10)}`;

async function evo(path: string, init: RequestInit = {}, timeoutMs = 60000) {
  const base = (process.env["EVOLUTION_API_URL"] ?? "").replace(/\/$/, "");
  const key = process.env["EVOLUTION_API_KEY"] ?? "";
  if (!base || !key) throw new Error("Servidor do WhatsApp não configurado.");
  let res: Response;
  try {
    res = await fetch(base + path, {
      ...init,
      headers: { "Content-Type": "application/json", apikey: key, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new Error("Servidor do WhatsApp está acordando (plano gratuito hiberna). Aguarde ~30s e tente de novo.");
    }
    throw e;
  }
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    console.error("evolution error", path, res.status, text.slice(0, 500));
    throw new Error(res.status === 404 ? "Conexão não encontrada no servidor." : `Servidor do WhatsApp respondeu ${res.status}.`);
  }
  return body as Record<string, unknown>;
}

function own(userId: string, name: string) {
  if (!name.startsWith(prefixFor(userId) + "-")) throw new Error("Conexão não pertence a esta conta.");
  return encodeURIComponent(name);
}

export type WaInstance = { name: string; label: string; status: string; number: string | null; profile: string | null };

export const waList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WaInstance[]> => {
    const p = prefixFor(context.userId) + "-";
    const list = (await evo("/instance/fetchInstances", {}, 25000)) as unknown as Array<Record<string, unknown>>;
    const { data: st } = await context.supabase.from("user_settings").select("wa_labels").maybeSingle();
    const labels = (st?.wa_labels ?? {}) as Record<string, string>;
    // garante o aviso de respostas em todas as conexões (interrompe o funil quando o cliente responde)
    const { registerInbound } = await import("@/lib/wa-inbound.server");
    await Promise.all((Array.isArray(list) ? list : []).filter((i) => String(i["name"] ?? "").startsWith(p)).map((i) => registerInbound(String(i["name"])).catch(() => false)));
    return (Array.isArray(list) ? list : [])
      .filter((i) => String(i["name"] ?? "").startsWith(p))
      .map((i) => ({
        name: String(i["name"]),
        label: labels[String(i["name"])] || String(i["name"]).slice(p.length),
        status: String(i["connectionStatus"] ?? "close"),
        number: i["ownerJid"] ? String(i["ownerJid"]).split("@")[0] ?? null : null,
        profile: i["profileName"] ? String(i["profileName"]) : null,
      }));
  });

export const waCreate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { label: string }) => d)
  .handler(async ({ data, context }) => {
    const slug = data.label.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) || "numero";
    // Suffix keeps names unique: Evolution rejects a reused name with 403.
    const name = `${prefixFor(context.userId)}-${slug}-${Date.now().toString(36).slice(-4)}`;
    await evo("/instance/create", { method: "POST", body: JSON.stringify({ instanceName: name, integration: "WHATSAPP-BAILEYS", qrcode: true }) });
    const label = data.label.trim();
    if (label) {
      const { data: st } = await context.supabase.from("user_settings").select("wa_labels").maybeSingle();
      const labels = { ...((st?.wa_labels ?? {}) as Record<string, string>), [name]: label };
      await context.supabase.from("user_settings").update({ wa_labels: labels }).eq("user_id", context.userId);
    }
    const { registerInbound } = await import("@/lib/wa-inbound.server");
    await registerInbound(name).catch(() => false);
    return { name };
  });

export const waQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) => d)
  .handler(async ({ data, context }) => {
    const r = await evo(`/instance/connect/${own(context.userId, data.name)}`);
    return { base64: typeof r["base64"] === "string" ? r["base64"] : null, pairingCode: typeof r["pairingCode"] === "string" ? r["pairingCode"] : null };
  });

export const waState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) => d)
  .handler(async ({ data, context }) => {
    const r = await evo(`/instance/connectionState/${own(context.userId, data.name)}`, {}, 20000);
    const inst = (r["instance"] ?? {}) as Record<string, unknown>;
    return { state: String(inst["state"] ?? "close") };
  });

export const waRemove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) => d)
  .handler(async ({ data, context }) => {
    const n = own(context.userId, data.name);
    try { await evo(`/instance/logout/${n}`, { method: "DELETE" }); } catch { /* already logged out */ }
    await evo(`/instance/delete/${n}`, { method: "DELETE" });
    return { ok: true };
  });

export const waSend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; phone: string; texts: string[] }) => d)
  .handler(async ({ data, context }) => {
    const n = own(context.userId, data.name);
    const number = normalizeBR(data.phone);
    if (!number) throw new Error("Telefone inválido.");
    const texts = data.texts.map((t) => t.trim()).filter(Boolean);
    for (const text of texts) {
      // delay = "digitando..." visível antes de cada mensagem, proporcional ao tamanho
      const delay = Math.min(8000, 1200 + text.length * 35 + Math.floor(Math.random() * 1500));
      await evo(`/message/sendText/${n}`, { method: "POST", body: JSON.stringify({ number, text, delay }) });
    }
    return { sent: texts.length, number };
  });

// Envia o funil completo para o número de teste do próprio usuário, em ordem, aguardando cada envio.
export const waTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; phone: string; texts: string[]; gapS: number }) => d)
  .handler(async ({ data, context }) => {
    const n = own(context.userId, data.name);
    const number = normalizeBR(data.phone);
    if (!number) throw new Error("Telefone de teste inválido.");
    const texts = data.texts.map((t) => t.trim()).filter(Boolean).slice(0, 3);
    await evo("/", {}, 60000).catch(() => null); // acorda o servidor antes da 1ª mensagem
    for (let i = 0; i < texts.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, Math.max(0, Math.min(30, data.gapS)) * 1000));
      await evo(`/message/sendText/${n}`, { method: "POST", body: JSON.stringify({ number, text: texts[i], delay: 1200 }) });
    }
    return { sent: texts.length };
  });
