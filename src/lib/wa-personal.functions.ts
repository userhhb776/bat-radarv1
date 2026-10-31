import { createServerFn } from "@tanstack/react-start";
import { requireApprovedAccount as requireSupabaseAuth } from "@/lib/access.middleware";
import { ownInstance } from "@/lib/wa-owner";

// "Meu WhatsApp": conversas pessoais lidas direto do servidor Evolution, sem IA e sem gravar no banco.
async function evoPost(path: string, body: unknown) {
  const { base, key } = await (await import("@/lib/service-config.server")).getEvo();
  if (!base || !key) throw new Error("Servidor do WhatsApp não configurado.");
  const r = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", apikey: key }, body: JSON.stringify(body), signal: AbortSignal.timeout(45000) }).catch(() => null);
  if (!r) throw new Error("Servidor do WhatsApp está acordando. Tente em 30s.");
  if (!r.ok) throw new Error(`Servidor do WhatsApp respondeu ${r.status}.`);
  return r.json() as Promise<any>;
}
const textOf = (m: any): string => {
  const x = m?.message ?? {};
  return String(x.conversation ?? x.extendedTextMessage?.text ?? x.imageMessage?.caption ?? (x.audioMessage ? "🎤 Áudio" : x.imageMessage ? "📷 Foto" : x.documentMessage ? "📄 Documento" : x.stickerMessage ? "Figurinha" : x.videoMessage ? "🎬 Vídeo" : ""));
};

export const myChats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) => d)
  .handler(async ({ data, context }) => {
    const n = await ownInstance(context, data.name);
    const list = await evoPost(`/chat/findChats/${n}`, {});
    return (Array.isArray(list) ? list : [])
      .filter((c: any) => String(c.remoteJid ?? "").endsWith("@s.whatsapp.net"))
      .map((c: any) => ({ jid: String(c.remoteJid), name: String(c.pushName ?? c.name ?? "") || String(c.remoteJid).split("@")[0], last: textOf(c.lastMessage), at: String(c.updatedAt ?? c.lastMessage?.messageTimestamp ?? ""), unread: Number(c.unreadCount ?? 0) }))
      .sort((a: any, b: any) => (a.at < b.at ? 1 : -1))
      .slice(0, 80);
  });

export const myMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; jid: string }) => d)
  .handler(async ({ data, context }) => {
    const n = await ownInstance(context, data.name);
    const r = await evoPost(`/chat/findMessages/${n}`, { where: { key: { remoteJid: data.jid } }, limit: 60 });
    const recs = Array.isArray(r) ? r : (r?.messages?.records ?? []);
    return (recs as any[]).map((m) => ({ id: String(m.key?.id ?? m.id), me: !!m.key?.fromMe, text: textOf(m), ts: Number(m.messageTimestamp ?? 0) }))
      .filter((m) => m.text).sort((a, b) => a.ts - b.ts);
  });
