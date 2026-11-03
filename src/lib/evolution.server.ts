import { normalizeBR } from "@/lib/phone";
/** gapMs: se informado, espera esse tempo (sorteado pela função) entre um balão e o próximo. */
export async function evoSend(instance: string, phone: string, texts: string[], gapMs?: () => number) {
  const { base, key } = await (await import("@/lib/service-config.server")).getEvo();
  if (!base || !key) throw new Error("Servidor do WhatsApp não configurado.");
  const number = normalizeBR(phone);
  if (!number) throw new Error("Telefone inválido.");
  // acorda o servidor gratuito antes de enviar
  await fetch(`${base}/`, { signal: AbortSignal.timeout(60000) }).catch(() => null);
  const list = texts.map((t) => t.trim()).filter(Boolean);
  for (const [i, text] of list.entries()) {
    if (i > 0 && gapMs) await new Promise((r) => setTimeout(r, gapMs()));
    const delay = Math.min(8000, 1200 + text.length * 35 + Math.floor(Math.random() * 1500));
    const res = await fetch(`${base}/message/sendText/${encodeURIComponent(instance)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key },
      body: JSON.stringify({ number, text, delay }),
      signal: AbortSignal.timeout(45000),
    });
    const responseText = await res.text();
  if (!res.ok) throw new Error(`Servidor do WhatsApp respondeu ${res.status}: ${responseText.slice(0, 300)}`);
  let response: any = null;
  try { response = responseText ? JSON.parse(responseText) : null; } catch { /* Algumas versões retornam corpo vazio. */ }
  if (response?.status === "ERROR" || response?.error) throw new Error(String(response?.message ?? response?.error ?? "A Evolution não confirmou o envio do áudio."));
  }
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");

/** Aplica uma etiqueta do WhatsApp Business (já criada no celular) à conversa. Retorna false se a etiqueta não existir. */
export async function evoLabel(instance: string, phone: string, labelName: string): Promise<boolean> {
  const { base, key } = await (await import("@/lib/service-config.server")).getEvo();
  const number = normalizeBR(phone);
  if (!base || !key || !number) return false;
  const inst = encodeURIComponent(instance);
  const r = await fetch(`${base}/label/findLabels/${inst}`, { headers: { apikey: key }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) { console.error("findLabels", r.status, (await r.text()).slice(0, 200)); return false; }
  const labels = (await r.json().catch(() => [])) as Array<{ id?: string; name?: string }>;
  const label = (Array.isArray(labels) ? labels : []).find((l) => norm(l.name ?? "") === norm(labelName));
  if (!label?.id) return false;
  const res = await fetch(`${base}/label/handleLabel/${inst}`, {
    method: "POST", headers: { "Content-Type": "application/json", apikey: key },
    body: JSON.stringify({ number, labelId: label.id, action: "add" }), signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) console.error("handleLabel", res.status, (await res.text()).slice(0, 200));
  return res.ok;
}

export async function evoGet(path: string, timeoutMs = 60000): Promise<unknown> {
  const { base, key } = await (await import("@/lib/service-config.server")).getEvo();
  if (!base || !key) throw new Error("Servidor do WhatsApp não configurado.");
  let res: Response;
  try {
    res = await fetch(base + path, { headers: { apikey: key }, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new Error("Servidor do WhatsApp está acordando. Aguarde ~30s e tente de novo.");
  }
  const text = await res.text();
  if (!res.ok) { console.error("evolution", path, res.status, text.slice(0, 300)); throw new Error(`Servidor do WhatsApp respondeu ${res.status}.`); }
  try { return JSON.parse(text); } catch { return null; }
}

/** Envia áudio como nota de voz gravada na hora (microfone verde), com "gravando..." antes. */
export async function evoSendAudio(instance: string, phone: string, base64: string, recordMs = 4000) {
  const { base, key } = await (await import("@/lib/service-config.server")).getEvo();
  if (!base || !key) throw new Error("Servidor do WhatsApp não configurado.");
  const number = normalizeBR(phone);
  if (!number) throw new Error("Telefone inválido.");
  const res = await fetch(`${base}/message/sendWhatsAppAudio/${encodeURIComponent(instance)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key },
    body: JSON.stringify({ number, audio: base64, delay: Math.min(15000, recordMs) }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Servidor do WhatsApp respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
