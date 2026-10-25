import { sha256 } from "@noble/hashes/sha2";

/** Token do webhook de respostas, derivado de um segredo do servidor (nunca exposto ao navegador). */
export function inboundToken() {
  const seed = process.env["VAPID_SEED"] ?? "";
  const h = sha256(new TextEncoder().encode(`wa-inbound:${seed}`));
  return Array.from(h.slice(0, 16)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const INBOUND_URL = "https://project--630b7e1b-b5e9-450e-a09f-ee7087d788d3.lovable.app/api/public/hooks/wa-inbound";

/** Liga o aviso de mensagens recebidas na conexão do WhatsApp (idempotente). */
export async function registerInbound(instance: string) {
  const base = (process.env["EVOLUTION_API_URL"] ?? "").replace(/\/$/, "");
  const key = process.env["EVOLUTION_API_KEY"] ?? "";
  if (!base || !key) return false;
  const url = `${INBOUND_URL}?t=${inboundToken()}`;
  const res = await fetch(`${base}/webhook/set/${encodeURIComponent(instance)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key },
    body: JSON.stringify({ webhook: { enabled: true, url, events: ["MESSAGES_UPSERT"], byEvents: false, base64: false } }),
    signal: AbortSignal.timeout(20000),
  }).catch(() => null);
  if (res && !res.ok) console.error("webhook/set", res.status, (await res.text()).slice(0, 200));
  return !!res?.ok;
}

/** Compara telefones tolerando o 9º dígito e formatos diferentes. */
export function samePhone(a: string, b: string) {
  const d = (s: string) => s.replace(/\D/g, "").replace(/^0+/, "");
  const x = d(a), y = d(b);
  if (!x || !y) return false;
  return x.slice(-8) === y.slice(-8) && (x.length < 10 || y.length < 10 || x.slice(-11, -9) === y.slice(-11, -9) || x.slice(-10, -8) === y.slice(-10, -8));
}
