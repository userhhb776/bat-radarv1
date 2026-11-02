import { sha256 } from "@noble/hashes/sha2";

/** Token do webhook de respostas, derivado de um segredo do servidor (nunca exposto ao navegador). */
export function inboundToken() {
  const seed = process.env["VAPID_SEED"] ?? "";
  const h = sha256(new TextEncoder().encode(`wa-inbound:${seed}`));
  return Array.from(h.slice(0, 16)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const INBOUND_URL = "https://bat-radarv1.lovable.app/api/public/hooks/wa-inbound";

/** Liga o aviso de mensagens recebidas na conexão do WhatsApp (idempotente). */
export async function registerInbound(instance: string) {
  const { base, key } = await (await import("@/lib/service-config.server")).getEvo();
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
  // reduz para DDD + 8 dígitos (sem 55 e sem o 9º dígito)
  const d = (s: string) => {
    let x = s.replace(/\D/g, "").replace(/^0+/, "");
    if (x.length >= 12 && x.startsWith("55")) x = x.slice(2);
    if (x.length === 11 && x[2] === "9") x = x.slice(0, 2) + x.slice(3);
    return x;
  };
  const x = d(a), y = d(b);
  if (!x || !y) return false;
  if (x.length < 10 || y.length < 10) return x.slice(-8) === y.slice(-8);
  return x === y;
}
