export type WaContact = { number: string; name: string };

export function contactMatches(contact: WaContact, query: string) {
  const clean = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const digits = query.replace(/\D/g, "");
  return clean(contact.name).includes(clean(query.trim())) || (digits.length > 0 && contact.number.includes(digits));
}

export function parseContacts(body: unknown): WaContact[] {
  const root = body as { records?: unknown; contacts?: unknown } | null;
  const rows = Array.isArray(body) ? body : root?.records ?? root?.contacts;
  if (!Array.isArray(rows)) return [];
  const contacts = new Map<string, WaContact>();
  for (const row of rows) {
    const jid = String(row?.remoteJid ?? row?.id ?? "");
    if (!jid.endsWith("@s.whatsapp.net")) continue;
    const number = jid.split("@")[0]?.replace(/\D/g, "") ?? "";
    if (!number) continue;
    contacts.set(number, { number, name: String(row?.name || row?.pushName || row?.verifiedName || number) });
  }
  return [...contacts.values()];
}