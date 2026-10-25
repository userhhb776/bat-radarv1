/** Normaliza telefones BR escritos de qualquer jeito ("+55 68 92316302", "(68) 9 9231-6302", "068...")
 * para dígitos no formato 55 + DDD + número. Celular com 8 dígitos ganha o 9 na frente. */
export function normalizeBR(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "").replace(/^00/, "");
  if (!d) return null;
  if (d.startsWith("0") && (d.length === 11 || d.length === 12)) d = d.slice(1); // 0 + DDD
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (!d.startsWith("55")) return d.length >= 8 ? d : null; // número estrangeiro: mantém
  const local = d.slice(4);
  if (local.length === 8 && /^[6-9]/.test(local)) d = d.slice(0, 4) + "9" + local;
  return d.length === 12 || d.length === 13 ? d : null;
}

/** true quando é celular brasileiro (9 + 8 dígitos). Fixos começam com 2–5 e têm 8 dígitos. */
export function isMobileBR(phone: string | null | undefined): boolean {
  const d = normalizeBR(phone);
  return !!d && d.startsWith("55") && d.length === 13 && d[4] === "9";
}

export function formatBR(phone: string | null | undefined): string {
  const d = normalizeBR(phone);
  if (!d || !d.startsWith("55") || d.length !== 13) return phone ?? "";
  return `+55 ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`;
}
