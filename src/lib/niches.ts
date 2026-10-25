// Varejo e moda fica no topo: nichos com maior taxa de resposta (relato do dono).
export const NICHE_GROUPS: Record<string, string[]> = {
  "Varejo e moda": ["Loja de roupas", "Loja de roupas femininas", "Loja de roupas masculinas", "Moda infantil", "Moda plus size", "Moda fitness", "Brechó", "Loja de calçados", "Loja de bolsas e acessórios", "Bijuteria e acessórios", "Joalheria", "Relojoaria", "Ótica", "Loja de perfumes e cosméticos", "Loja de lingerie", "Loja de uniformes", "Atelier de costura", "Loja de celulares", "Loja de eletrônicos", "Loja de informática", "Assistência técnica de celular", "Papelaria", "Livraria", "Loja de brinquedos", "Loja de artigos esportivos", "Loja de bicicletas", "Loja de móveis", "Loja de decoração", "Loja de colchões", "Loja de artigos de festa", "Presentes e lembrancinhas", "Floricultura", "Mercado", "Hortifruti", "Açougue", "Peixaria", "Empório", "Loja de suplementos", "Loja de pedras e cristais", "Outlets", "Feira e lojinha"],
  Saúde: ["Clínica odontológica", "Dentista", "Clínica médica", "Fisioterapia", "Psicólogo", "Nutricionista", "Clínica de estética", "Dermatologista", "Oftalmologista", "Pediatra", "Ginecologista", "Cardiologista", "Ortopedista", "Otorrino", "Fonoaudiólogo", "Podólogo", "Acupuntura", "Quiropraxia", "Massoterapia", "Terapias naturais", "Laboratório de análises clínicas", "Clínica veterinária", "Farmácia", "Farmácia de manipulação", "Clínica de reabilitação", "Home care", "Cuidador de idosos"],
  Beleza: ["Salão de beleza", "Barbearia", "Manicure e pedicure", "Alongamento de unhas", "Estúdio de sobrancelhas", "Extensão de cílios", "Estúdio de tatuagem", "Micropigmentação", "Depilação", "Spa", "Maquiadora", "Salão masculino", "Laser e depilação a laser", "Estética facial", "Limpeza de pele"],
  Alimentação: ["Restaurante", "Pizzaria", "Hamburgueria", "Padaria", "Confeitaria", "Cafeteria", "Sorveteria", "Açaí", "Restaurante japonês", "Restaurante por quilo", "Churrascaria", "Lanchonete", "Pastelaria", "Esfiha", "Marmitaria", "Bar", "Boteco", "Choperia", "Food truck", "Doceria", "Galeteria", "Chocolateria", "Casa de sucos", "Vegano e vegetariano", "Pizzaria artesanal", "Comida árabe", "Peixaria e frutos do mar"],
  Serviços: ["Advogado", "Contabilidade", "Imobiliária", "Corretora de imóveis", "Despachante", "Seguros", "Agência de viagens", "Gráfica", "Agência de marketing", "Fotógrafo", "Vídeo e edição", "Tradutor", "Chaveiro", "Lavanderia", "Costura e remendo", "Buffet de festas", "Salão de festas", "Cerimonialista", "Coworking", "Transportadora", "Mudanças e fretes", "Locação de veículos", "Funerária", "Serviços de limpeza", "Portaria e segurança", "Controle de pragas", "Fretes e carretos"],
  "Casa e construção": ["Construtora", "Arquiteto", "Marcenaria", "Serralheria", "Vidraçaria", "Eletricista", "Encanador", "Pintor", "Gesso", "Aquecimento e ar-condicionado", "Loja de material de construção", "Dedetizadora", "Jardinagem", "Paisagismo", "Energia solar", "Móveis planejados", "Limpeza residencial", "Limpeza de estofados", "Desentupidora", "Cercas e portões", "Tapeçaria", "Ferro-velho", "Manutenção predial"],
  Automotivo: ["Oficina mecânica", "Auto elétrica", "Funilaria e pintura", "Lava rápido", "Estética automotiva", "Borracharia", "Autoescola", "Loja de autopeças", "Loja de pneus", "Revenda de carros", "Compra de carros usados", "Guincho", "Som automotivo", "Martelinho de ouro", "Rastreamento veicular", "Despachante veicular", "Oficina de motos", "Mecânica diesel"],
  "Educação e esporte": ["Academia", "Estúdio de pilates", "Crossfit", "Yoga", "Escola de idiomas", "Escola particular", "Curso preparatório", "Curso técnico", "Escola de música", "Escola de dança", "Artes marciais", "Personal trainer", "Natação", "Escolinha de futebol", "Creche", "Aulas particulares", "Cursos online", "Fotografia e design"],
  Pets: ["Pet shop", "Banho e tosa", "Hotel para cães", "Adestrador", "Creche para pets", "Veterinário domiciliar", "Padaria para pets", "Ração e acessórios"],
  Hospedagem: ["Pousada", "Hotel", "Hostel", "Casa de eventos", "Aluguel de temporada", "Salão de eventos", "Buffet e espaço"],
};
export const NICHES = Object.values(NICHE_GROUPS).flat();

// Detecta quando o "site" cadastrado no Google é só um perfil social ou link de WhatsApp.
const SOCIAL_HOSTS = ["instagram.com", "wa.me", "whatsapp.com", "api.whatsapp.com", "linktr.ee", "facebook.com", "fb.com", "tiktok.com", "bio.link", "beacons.ai"];
export function isSocialLink(url: string | null) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return SOCIAL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

