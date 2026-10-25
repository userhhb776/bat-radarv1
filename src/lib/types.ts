import { normalizeBR } from "./phone";
export type PlaceLead = {
  placeId: string;
  name: string;
  phone: string | null;
  intlPhone: string | null;
  address: string | null;
  website: string | null;
  rating: number | null;
  reviews: number;
  mapsUrl: string | null;
};

export type Audit = {
  nota_presenca: number;
  resumo: string;
  pontos_fortes: string[];
  gargalos: { titulo: string; detalhe: string; impacto?: string }[];
  oportunidade: string;
  recomendacoes?: { acao: string; porque: string }[];
  argumento_venda?: string;
};

export const STATUSES = [
  { id: "novo", label: "Novo" },
  { id: "enviada", label: "Mensagem Enviada" },
  { id: "respondeu", label: "Respondeu" },
  { id: "reuniao", label: "Reunião Agendada" },
  { id: "fechado", label: "Fechado" },
  { id: "perdido", label: "Perdido" },
] as const;

export type LeadStatus = (typeof STATUSES)[number]["id"];

export type Opportunity = { level: "quente" | "morna" | "fria"; label: string };

export function opportunityOf(l: { website: string | null; rating: number | null; reviews: number }): Opportunity {
  if (!l.website) return { level: "quente", label: "Alta · sem site" };
  if ((l.rating ?? 0) < 4.2 || l.reviews < 30) return { level: "morna", label: "Média · perfil fraco" };
  return { level: "fria", label: "Baixa · bem posicionada" };
}

export function whatsappLink(phone: string | null, message: string) {
  if (!phone) return null;
  const digits = normalizeBR(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
