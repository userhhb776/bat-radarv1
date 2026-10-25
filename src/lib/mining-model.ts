import { isSocialLink } from "@/lib/niches";

// ---------- Aprendizado com o usuário (sem IA, custo zero) ----------
export type Feat = { niche: string | null; rating: number | null; reviews_count: number | null; website: string | null; address: string | null; name: string };
const RV = [30, 80, 200, 500, 1500];
const RT = [4.3, 4.6, 4.8];
const bucket = (v: number, cuts: number[]) => cuts.findIndex((c) => v < c) === -1 ? cuts.length : cuts.findIndex((c) => v < c);
const STOP = new Set(["loja", "lojas", "store", "casa", "para", "com", "dos", "das", "the"]);
export function feats(c: Feat): string[] {
  const f = [
    `rv:${bucket(c.reviews_count ?? 0, RV)}`,
    `rt:${c.rating == null ? "x" : bucket(c.rating, RT)}`,
    `pres:${isSocialLink(c.website) ? "social" : c.website ? "site" : "nada"}`,
    `shop:${/shopping|mall/i.test(c.address ?? "") ? 1 : 0}`,
    `multi:${/(unidade|filial|matriz|franquia|ltda|s\.?a\.?$|\bgrupo\b|rede )/i.test(c.name) ? 1 : 0}`,
  ];
  if (c.niche) f.push(`n:${c.niche.toLowerCase()}`);
  for (const w of c.name.toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]/g, " ").split(/\s+/)) if (w.length >= 4 && !STOP.has(w)) f.push(`w:${w}`);
  return f;
}
const STATUS_W: Record<string, number> = { novo: 1, enviada: 1.5, respondeu: 3, reuniao: 4, fechado: 5 };
export type Model = { pos: Map<string, number>; neg: Map<string, number>; P: number; N: number };
export function buildModel(leads: Array<Feat & { status: string; source: string; last_contact_at?: string | null }>, discards: Feat[]): Model {
  const m: Model = { pos: new Map(), neg: new Map(), P: 0, N: 0 };
  const add = (c: Feat, w: number, into: "pos" | "neg") => {
    for (const k of feats(c)) m[into].set(k, (m[into].get(k) ?? 0) + w);
    if (into === "pos") m.P += w; else m.N += w;
  };
  for (const l of leads) {
    if (l.source === "externo") continue;
    if (l.status === "perdido") add(l, 1, "neg");
    else if (noReply(l)) add(l, 1.5, "neg");
    else add(l, STATUS_W[l.status] ?? 1, "pos");
  }
  for (const d of discards) add(d, 2, "neg");
  return m;
}
/** Pontuação aprendida: >0 parece o que você salva/responde; <0 parece o que você descarta. */
export function learned(c: Feat, m: Model) {
  if (m.P + m.N < 5) return 0;
  let s = 0;
  for (const k of feats(c)) {
    const w = k.startsWith("w:") ? 0.3 : k.startsWith("n:") ? 0.6 : 1;
    s += w * (Math.log(((m.pos.get(k) ?? 0) + 0.5) / (m.P + 1)) - Math.log(((m.neg.get(k) ?? 0) + 0.5) / (m.N + 1)));
  }
  return s;
}

/** Mensagem enviada há mais de 4 dias sem resposta: conta como perfil que não funciona. */
export function noReply(l: { status: string; last_contact_at?: string | null }) {
  return l.status === "enviada" && !!l.last_contact_at && Date.now() - new Date(l.last_contact_at).getTime() > 4 * 86400000;
}
