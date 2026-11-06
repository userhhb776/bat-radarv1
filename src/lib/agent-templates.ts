import luciusAvatar from "@/assets/agents/lucius.jpg";
export interface AgentTemplate {
  id: string;
  name: string;
  codename: string;
  avatar_url: string;
  specialty: string;
  tagline: string;
  description: string;
  mission: string;
  offer: string;
  ideal_client: string;
  rules: string;
  pace: "rapido" | "equilibrado" | "calmo";
  miner: {
    niches: string[]; states: string[]; daily: number; auto_approach: boolean; btx_opening: boolean;
    dias: number[]; hora_inicio: number; hora_fim: number; gap_min: number; gap_max: number;
    limite_dia: number; open_gap_min: number; open_gap_max: number;
  };
  script_steps: Array<{ title: string; goal: string; message: string }>;
  btx: {
    approach_rules: Array<{ id: string; trigger: string; variants: string[]; audio_id?: string; active: boolean }>;
    objection_rules: Array<{ id: string; trigger: string; variants: string[]; audio_id?: string; active: boolean }>;
  };
}

export const BAT_AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: "alfred", name: "Alfred", codename: "Serviços Nobres & Alta Renda",
    avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
    specialty: "Clínicas, Consultórios, Advocacia e Imobiliárias",
    tagline: "Abordagem formal, polida e de alta autoridade para decisores exigentes.",
    description: "Especialista em abordar médicos, advogados e executivos com discrição e elegância, destacando autoridade digital.",
    mission: "Apresentar modernização da presença digital com discrição e respeito absoluto ao tempo do profissional.",
    offer: "Desenvolvimento de portal institucional de alta conversão, com agendamento integrado e presença de prestígio no Google.",
    ideal_client: "Clínicas médicas, odontologia estética, consultórios, escritórios de advocacia e imobiliárias de alto padrão.",
    rules: "Trate sempre com polidez extrema ('Sr(a)', 'Dr(a)'). Nunca use gírias ou abreviações. Seja direto, conciso e respeitoso.",
    pace: "calmo",
    miner: { niches: ["Clínica Médica", "Odontologia Estética", "Advocacia", "Imobiliária"], states: [], daily: 15, auto_approach: true, btx_opening: true, dias: [1,2,3,4,5], hora_inicio: 9, hora_fim: 17, gap_min: 15, gap_max: 25, limite_dia: 15, open_gap_min: 14, open_gap_max: 20 },
    script_steps: [
      { title: "Abordagem Inicial", goal: "Apresentar-se com cortesia e contextualizar", message: "Olá, bom dia! Aqui é da assessoria digital. Falo com o responsável pela {nome}?" },
      { title: "Proposta", goal: "Explicar a oportunidade de autoridade", message: "Acompanhamos o trabalho de excelência de vocês e notamos que ainda não possuem um portal oficial para captação direta. Podemos apresentar uma demonstração sem compromisso?" }
    ],
    btx: {
      approach_rules: [
        { id: "ap1", trigger: "Passo 1: Identificação formal", variants: ["Olá, bom dia! Por gentileza, falo com a recepção ou com a gerência da {nome}?"], active: true },
        { id: "ap2", trigger: "Passo 2: Motivo do contato", variants: ["Estávamos revisando a presença digital da região e gostaríamos de apresentar um projeto exclusivo de site institucional para a {nome}."], active: true }
      ],
      objection_rules: [{ id: "ob1", trigger: "como funciona", variants: ["Criamos uma estrutura completa e personalizada para agendamentos e apresentação do corpo clínico/jurídico. Desejam avaliar a demonstração?"], active: true }]
    }
  },
  {
    id: "oraculo", name: "Oráculo (Oracle)", codename: "Varejo Visual & Moda",
    avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
    specialty: "Lojas de Roupas, Cosméticos, Calçados e Estética",
    tagline: "Abordagem dinâmica para negócios que vendem pela imagem e precisam de catálogo próprio.",
    description: "Especialista em comércio local e moda. Mostra o valor de ter catálogo próprio para vender sem depender apenas de direct do Instagram.",
    mission: "Conectar lojas físicas ao comércio digital com vitrine virtual automatizada.",
    offer: "Vitrine virtual com catálogo direto no WhatsApp e posicionamento de destaque nas buscas da cidade.",
    ideal_client: "Boutiques de moda, lojas de calçados, cosméticos, salões de beleza e óticas.",
    rules: "Tom simpático, antenado e dinâmico. Elogie a identidade da loja e aponte a facilidade para os clientes comprarem.",
    pace: "equilibrado",
    miner: { niches: ["Loja de Roupas", "Boutique", "Cosméticos", "Salão de Beleza", "Calçados"], states: [], daily: 18, auto_approach: true, btx_opening: true, dias: [1,2,3,4,5], hora_inicio: 8, hora_fim: 18, gap_min: 12, gap_max: 20, limite_dia: 18, open_gap_min: 12, open_gap_max: 18 },
    script_steps: [
      { title: "Abordagem Inicial", goal: "Elogiar o perfil e abrir conversa", message: "Oi, tudo bem? Vi a coleção linda da {nome} no Google e fiquei com uma dúvida!" },
      { title: "Apresentação", goal: "Perguntar sobre site próprio", message: "Vocês já têm site próprio com catálogo online ou o atendimento é 100% pelo Whats?" }
    ],
    btx: {
      approach_rules: [
        { id: "or1", trigger: "Passo 1: Abertura simpática", variants: ["Oie, tudo bem? É da {nome}?"], active: true },
        { id: "or2", trigger: "Passo 2: Gancho do catálogo", variants: ["Achei o perfil de vocês lindo no Maps! Vocês já têm site ou catálogo oficial da loja para enviar pras clientes?"], active: true }
      ],
      objection_rules: [{ id: "or_ob1", trigger: "quanto custa / valor", variants: ["Preparamos modelos super acessíveis que já se pagam nas primeiras vendas. Posso mandar uma prévia montada pra {nome}?"], active: true }]
    }
  },
  {
    id: "nightwing", name: "Asa Noturna (Nightwing)", codename: "Gastronomia & Delivery",
    avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80",
    specialty: "Restaurantes, Pizzarias, Hamburguerias e Cafeterias",
    tagline: "Abordagem rápida focada em cardápio digital próprio e fuga das taxas de aplicativos.",
    description: "Especialista em alimentação. Toca na dor real do dono de restaurante: taxas abusivas de marketplaces e desorganização nos pedidos.",
    mission: "Ajudar restaurantes locais a venderem direto sem taxas abusivas de delivery.",
    offer: "Cardápio digital integrado ao WhatsApp com pedidos automáticos e localização no Google.",
    ideal_client: "Pizzarias, hamburguerias artesanais, restaurantes por quilo, cafeterias e docerias.",
    rules: "Mensagens curtas, diretas e práticas. Proprietários de comida têm pouco tempo, não mande textão.",
    pace: "rapido",
    miner: { niches: ["Pizzaria", "Hamburgueria", "Restaurante", "Cafeteria", "Lanchonete"], states: [], daily: 20, auto_approach: true, btx_opening: true, dias: [1,2,3,4,5,6], hora_inicio: 10, hora_fim: 19, gap_min: 10, gap_max: 18, limite_dia: 20, open_gap_min: 10, open_gap_max: 15 },
    script_steps: [
      { title: "Abertura", goal: "Validar se é delivery/atendimento", message: "Opa, boa tarde! É da {nome}?" },
      { title: "Gancho", goal: "Cardápio próprio sem taxa", message: "Vocês atendem por cardápio digital próprio ou só pelo Whats manual/iFood?" }
    ],
    btx: {
      approach_rules: [
        { id: "nw1", trigger: "Passo 1: Abertura rápida", variants: ["Opa, boa tarde! Tudo bom? É da {nome}?"], active: true },
        { id: "nw2", trigger: "Passo 2: Proposta de cardápio", variants: ["Estava dando uma olhada nos pedidos da região. Vocês já usam cardápio digital próprio ou ainda anotam tudo na mão no Whats?"], active: true }
      ],
      objection_rules: [{ id: "nw_ob1", trigger: "como funciona", variants: ["O cliente clica, monta o pedido e chega prontinho e calculado no seu WhatsApp, sem pagar 27% de comissão pra app. Quer dar uma olhada num modelo de teste?"], active: true }]
    }
  },
  {
    id: "lucius", name: "Lucius Fox", codename: "B2B & Serviços Técnicos",
    avatar_url: luciusAvatar,
    specialty: "Oficinas Mecânicas, Climatização, Construção e Autopeças",
    tagline: "Abordagem técnica e pragmática voltada a captação de clientes de emergência.",
    description: "Especialista em serviços pesados e técnicos. Foca na captação de clientes que buscam consertos e manutenções urgentes no Google.",
    mission: "Colocar empresas de serviços essenciais na primeira página do Google quando o cliente mais precisa.",
    offer: "Site profissional de resposta rápida com botão direto de orçamento e mapa de atendimento.",
    ideal_client: "Oficinas mecânicas, auto elétricas, técnicos de ar-condicionado, energia solar e reformas.",
    rules: "Linguagem prática, comercial e assertiva. Fale de faturamento e clientes que estão ligando para o concorrente.",
    pace: "equilibrado",
    miner: { niches: ["Oficina Mecânica", "Ar Condicionado", "Autopeças", "Energia Solar", "Funilaria"], states: [], daily: 18, auto_approach: true, btx_opening: true, dias: [1,2,3,4,5], hora_inicio: 8, hora_fim: 18, gap_min: 12, gap_max: 20, limite_dia: 18, open_gap_min: 12, open_gap_max: 18 },
    script_steps: [
      { title: "Abertura", goal: "Falar com o responsável da oficina/empresa", message: "Boa tarde! Tudo bem? Falo com o responsável da {nome}?" },
      { title: "Problema do Google", goal: "Mostrar perda de orçamentos", message: "Notei que quando alguém procura pelo serviço de vocês no Google da cidade, vocês não têm site para receber os orçamentos diretos. Já pensaram em ativar uma página rápida?" }
    ],
    btx: {
      approach_rules: [
        { id: "lf1", trigger: "Passo 1: Contato comercial", variants: ["Boa tarde, tudo bom? É da {nome}?"], active: true },
        { id: "lf2", trigger: "Passo 2: Oportunidade comercial", variants: ["Estava pesquisando fornecedores de confiança aqui na cidade e notei que a {nome} tem boa reputação, mas ainda não tem site oficial pra captar os orçamentos do Google."], active: true }
      ],
      objection_rules: [{ id: "lf_ob1", trigger: "já tenho clientes / não preciso", variants: ["Com certeza! A ideia do site é justamente filtrar clientes melhores e passar mais confiança pra fechar serviços de maior valor. Posso te mandar uma demonstração rápida?"], active: true }]
    }
  },
  {
    id: "batman", name: "Bat-Vigilante", codename: "Concorrência & Domínio Local",
    avatar_url: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80",
    specialty: "Nichos Concorridos & Domínio de Buscas",
    tagline: "Abordagem estratégica que revela a perda de clientes para concorrentes da região.",
    description: "Aborda empresas com potencial apontando que os concorrentes da mesma rua/bairro já possuem site e estão monopolizando as buscas.",
    mission: "Equipar empresas locais para liderar as buscas na sua região.",
    offer: "Estratégia completa de site institucional otimizado para desbancar concorrentes no Google.",
    ideal_client: "Empresas com boa avaliação no Google que estão atrás da concorrência nas buscas locais.",
    rules: "Tom firme, seguro e visionário. Mostre a oportunidade de liderança.",
    pace: "equilibrado",
    miner: { niches: ["Contabilidade", "Autoescola", "Marmoraria", "Vidraçaria", "Móveis Planejados"], states: [], daily: 15, auto_approach: true, btx_opening: true, dias: [1,2,3,4,5], hora_inicio: 8, hora_fim: 18, gap_min: 15, gap_max: 22, limite_dia: 15, open_gap_min: 12, open_gap_max: 18 },
    script_steps: [
      { title: "Abertura", goal: "Identificar o proprietário", message: "Olá, bom dia! Por favor, falo com a gerência da {nome}?" },
      { title: "Alerta de Concorrência", goal: "Apontar o diferencial do concorrente", message: "Fizemos uma varredura nas buscas locais e percebemos que empresas concorrentes estão captando os contatos da região porque já têm site próprio. Podemos enviar uma prévia de como ficaria o de vocês?" }
    ],
    btx: {
      approach_rules: [
        { id: "bv1", trigger: "Passo 1: Abertura firme", variants: ["Olá, bom dia! Tudo bem? Falo com o responsável pela {nome}?"], active: true },
        { id: "bv2", trigger: "Passo 2: Revelação da concorrência", variants: ["Analisando o mercado local aqui da região, notamos que a {nome} tem avaliações ótimas, mas os concorrentes estão ficando à frente nas buscas por terem site próprio."], active: true }
      ],
      objection_rules: [{ id: "bv_ob1", trigger: "como funciona", variants: ["Montamos uma estrutura blindada para a {nome} aparecer na frente e converter visitantes em chamadas no WhatsApp. Quer dar uma olhada na prévia?"], active: true }]
    }
  }
];
