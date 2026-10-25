import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireApprovedAccount as requireSupabaseAuth } from "@/lib/access.middleware";
import { fetchPlaceDetails } from "./places.functions";

const AuditSchema = z.object({
  nota_presenca: z.number(),
  resumo: z.string(),
  pontos_fortes: z.array(z.string()),
  gargalos: z.array(z.object({ titulo: z.string(), detalhe: z.string(), impacto: z.string() })),
  oportunidade: z.string(),
  recomendacoes: z.array(z.object({ acao: z.string(), porque: z.string() })),
  argumento_venda: z.string(),
});

export const auditLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ placeId: z.string().min(1).max(300), niche: z.string().max(80).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { streamText, Output, NoObjectGeneratedError } = await import("ai");
    const { createAstraModel, astraOptions, friendlyAiError } = await import("./ai-gateway.server");
    const d = await fetchPlaceDetails(data.placeId);
    const reviews = ((d["reviews"] ?? []) as any[]).slice(0, 5).map((r) => ({
      nota: r.rating,
      quando: r.relativePublishTimeDescription,
      data: r.publishTime,
      texto: r.text?.text?.slice(0, 400),
    }));
    const profile = {
      nome: d["displayName"]?.text,
      categoria: d["primaryTypeDisplayName"]?.text ?? data.niche,
      endereco: d["formattedAddress"],
      site: d["websiteUri"] ?? "NÃO POSSUI SITE",
      nota: d["rating"],
      total_avaliacoes: d["userRatingCount"] ?? 0,
      quantidade_fotos_retornadas: (d["photos"] ?? []).length,
      tem_horario_cadastrado: !!d["regularOpeningHours"],
      descricao: d["editorialSummary"]?.text ?? "sem descrição",
      avaliacoes_recentes: reviews,
      hoje: new Date().toISOString().slice(0, 10),
    };
    try {
      const result = streamText({
        model: createAstraModel(),
        output: Output.object({ schema: AuditSchema }),
        providerOptions: astraOptions,
        system:
          "Você é um consultor sênior de marketing local (Google Meu Negócio, SEO local e sites) que prepara um freelancer para vender site e otimização de perfil para pequenas empresas brasileiras. Seja direto, específico e prático, em português do Brasil. Nada de frases genéricas como 'melhorar a presença digital': cite números reais do perfil (nota, nº de avaliações, fotos, datas das avaliações, trechos de reclamações).",
        prompt: `Audite este perfil do Google Maps. Use SOMENTE os dados fornecidos; se algo não estiver nos dados, não afirme.
Analise: site (existe? se não, quanto perde), volume e recência das avaliações (compare datas com "hoje"), nota, reclamações recorrentes nos textos, quantidade de fotos, horário cadastrado, descrição, e se há sinais de que o dono não responde avaliações.
Regras de saída:
- nota_presenca: 0 a 10 (seja rigoroso).
- resumo: 2 frases, diagnóstico franco do estado atual.
- pontos_fortes: 2 a 4 itens curtos e concretos (com número quando possível).
- gargalos: 3 a 6 itens do que a empresa está fazendo ERRADO. titulo curto; detalhe = o erro com evidência dos dados; impacto = o que isso custa em clientes/dinheiro na prática.
- recomendacoes: 3 a 5 ações que EU (o prospector) devo propor/fazer, em ordem de prioridade, começando com verbo (ex.: "Ofereça uma landing page com botão de WhatsApp e cardápio"). porque = 1 frase ligando ao gargalo.
- oportunidade: 1 frase com o maior ganho para a empresa.
- argumento_venda: 1-2 frases que eu posso falar ao dono para abrir a conversa, usando um dado específico dele.
Dados: ${JSON.stringify(profile)}`,
      });
      const out = await result.output;
      return { ...out, nota_presenca: Math.max(0, Math.min(10, Math.round(out.nota_presenca))) };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) throw new Error("A IA não retornou uma auditoria válida. Tente novamente.");
      throw friendlyAiError(error);
    }
  });

export const generateMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().max(200),
        niche: z.string().max(80).optional(),
        city: z.string().max(120).optional(),
        website: z.string().max(500).nullable().optional(),
        rating: z.number().nullable().optional(),
        reviews: z.number().optional(),
        audit: z.any().optional(),
        senderName: z.string().max(80).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { streamText } = await import("ai");
    const { createAstraModel, astraOptions, friendlyAiError } = await import("./ai-gateway.server");
    try {
      const result = streamText({
        model: createAstraModel(),
        providerOptions: astraOptions,
        system:
          "Você é um copywriter especialista em prospecção fria por WhatsApp para donos de pequenos negócios brasileiros. Escreve como uma pessoa real da cidade falando com o dono — nunca como agência, robô ou spam. Português do Brasil, informal-respeitoso, frases curtas. Nunca invente dados.",
        prompt: `Escreva UMA mensagem de primeira abordagem no WhatsApp para o DONO da empresa abaixo.
Objetivo único: conseguir uma resposta (não vender ainda).
Estrutura (3 blocos curtos separados por linha em branco):
1) Abertura + elogio ESPECÍFICO com um dado real (ex.: "vi que vocês têm 4,8 com 230 avaliações aqui em ${data.city ?? "sua cidade"}", ou um ponto forte da auditoria). Cite o nome da empresa.
2) Problema visível e concreto com consequência (use o gargalo mais forte da auditoria, se houver): ex.: "quem procura ${data.niche ?? "o serviço"} no Google e não acha um site acaba clicando no concorrente do lado". Fale da perda de clientes, não de "presença digital".
3) Gancho de baixo atrito: UMA pergunta de sim/não, ex.: "Posso te mandar um print de como vocês aparecem hoje vs. o concorrente?" ou "Topa que eu te mande uma prévia gratuita de como ficaria o site?".
PROIBIDO: "Olá, tudo bem?" sozinho, "Prezados", "somos uma agência", "alavancar", "presença digital", "soluções", "no mercado", listas, links, preços, mais de 1 emoji, mais de 450 caracteres.
Adapte a linguagem ao nicho (ex.: clínica = mais cuidadoso; barbearia/pizzaria = mais descontraído).
${data.senderName ? `Assine como ${data.senderName}.` : "Não assine com nome; comece direto com 'Oi, pessoal da <nome da empresa>!'."}
Retorne apenas o texto da mensagem.
Dados: ${JSON.stringify(data)}`,
      });
      const text = (await result.text).trim();
      if (!text) throw new Error("A IA não gerou a mensagem. Tente novamente.");
      return { message: text };
    } catch (error) {
      throw friendlyAiError(error);
    }
  });
