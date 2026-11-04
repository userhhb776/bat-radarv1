import { describe, it, expect } from "vitest";
import { isFromMeFlag } from "./wa-inbound.server";
import { paceDelayMs, fillTemplate, splitBubbles, matchBtxRule, matchExistingTeamRule, normalizeGeneratedBtxRules, normalizeBtxRuleNumbering, matchPositiveBtxRule, matchPositiveReplyRule, sequenceReply, adaptGreeting, isEmailOrForwardRequest, openingMessagesFor, matchLimpMessage } from "./agents.server";

describe("agentes", () => {
  it("ritmo normal espera entre 15 e 40 segundos", () => {
    expect(paceDelayMs("equilibrado", 0)).toBe(15000);
    expect(paceDelayMs("equilibrado", 1)).toBe(40000);
  });
  it("ritmo ocupado espera até 85 segundos", () => { expect(paceDelayMs("calmo", 1)).toBe(85000); });
  it("preenche {nome} com o nome curto da empresa", () => {
    expect(fillTemplate("Vi a {nome} em {cidade}", { name: "Clínica Sorriso - Centro", city: "Rio Branco" })).toBe("Vi a Clínica Sorriso em Rio Branco");
  });
  it("linha em branco separa balões, no máximo 3", () => { expect(splitBubbles("a\n\nb\n\nc\n\nd")).toEqual(["a", "b", "c"]); });
});

import { pickVariant } from "./agents.server";
import { test as t2, expect as e2 } from "vitest";
t2("B-T6X sorteia entre variações e ignora vazias", () => {
  e2(pickVariant(["a", " ", "b"], 0)).toBe("a");
  e2(pickVariant(["a", " ", "b"], 0.99)).toBe("b");
  e2(pickVariant([], 0.5)).toBe("");
});

describe("prioridade do B-T6X", () => {
  const rules = [
    { when: "Quando o cliente pergunta se você é uma IA", variants: ["Kkk sou o assistente virtual da equipe"] },
    { when: "Quando o cliente pergunta o preço", variants: ["Vou confirmar o valor certinho"] },
  ];
  it("reconhece pergunta sobre IA mesmo com palavras diferentes", () => {
    expect(matchBtxRule("Você é um robô? kk", rules)?.variants[0]).toContain("assistente virtual");
  });
  it("reconhece pergunta de preço por sinônimos", () => {
    expect(matchBtxRule("Quanto custa?", rules)?.variants[0]).toContain("valor");
  });
  it("não escolhe resposta pronta sem correspondência", () => {
    expect(matchBtxRule("Vocês atendem aos sábados?", rules)).toBeNull();
  });
});

describe("B-T6X explicit team objection", () => {
  it("prioritizes the configured existing-team response for natural Portuguese wording", () => {
    const teamRule = { when: "Já tem equipe / agência / profissional", variants: ["Tudo bem! Obrigado pelo retorno."] };
    expect(matchExistingTeamRule("Nós já temos uma equipe que trabalha com isso. Muito obrigada!", [teamRule])).toBe(teamRule);
  });
  it("does not match unrelated messages", () => {
    const teamRule = { when: "Já tem equipe / agência / profissional", variants: ["Resposta pronta"] };
    expect(matchExistingTeamRule("Quanto custa o site?", [teamRule])).toBeNull();
  });
});

describe("B-T6X linear flow", () => {
  const rules = [{ when: "cliente aceita continuar", mode: "sequence" as const, variants: ["Passo 1: apresentação", "Passo 2: envio do catálogo", "Passo 3: encerramento"] }];
  it("advances exactly one step after a positive reply", () => {
    const result = sequenceReply([
      { role: "assistant", content: "Passo 1: apresentação" },
      { role: "user", content: "Sim, pode mandar" },
    ], rules, {}, "Cliente");
    expect(result?.replies).toEqual(["Passo 2: envio do catálogo"]);
  });
  it("allows semantic acceptance from the AI to advance a sequence without keyword matching", () => {
    const result = sequenceReply([
      { role: "assistant", content: "Passo 1: apresentação" },
      { role: "user", content: "Opa, boa noite. Pode sim!" },
    ], rules, {}, "Cliente", true);
    expect(result?.replies).toEqual(["Passo 2: envio do catálogo"]);
  });
  it("does not consume a negative reply as a sequence step", () => {
    const result = sequenceReply([
      { role: "assistant", content: "Passo 1: apresentação" },
      { role: "user", content: "Não tenho interesse" },
    ], rules, {}, "Cliente");
    expect(result).toBeNull();
  });
  it("seleciona a regra de aceite quando a confirmação vem junto de uma pergunta", () => {
    const acceptance = { when: "Cliente aceita receber a apresentação", mode: "alternatives" as const, variants: ["Perfeito! Vou te explicar como funciona."] };
    expect(matchPositiveReplyRule("Boa tarde Lucas. Pode sim, como funcionaria?", [acceptance])).toBe(acceptance);
  });
  it("não força uma regra de aceite quando a mensagem não confirma", () => {
    const acceptance = { when: "Cliente aceita receber a apresentação", variants: ["Perfeito!"] };
    expect(matchPositiveReplyRule("Como funcionaria?", [acceptance])).toBeNull();
  });
  it("seleciona regra de aceite configurada como alternativas após resposta positiva", () => {
    const acceptance = { when: "Quando o cliente aceita continuar", mode: "alternatives" as const, variants: ["Perfeito! Vou te mostrar como funciona.", "Boa! Posso te explicar os próximos passos."] };
    expect(matchPositiveBtxRule([acceptance])).toBe(acceptance);
  });
  it("não confunde regras de abertura com regras de aceite", () => {
    const opening = { when: "Abordagem inicial - mensagem 1", variants: ["Olá!"] };
    expect(matchPositiveBtxRule([opening])).toBeNull();
  });
  it("detects email and forwarding requests", () => {
    expect(isEmailOrForwardRequest("Pode enviar para contato@empresa.com")).toBe(true);
    expect(isEmailOrForwardRequest("Encaminhe ao setor responsável")).toBe(true);
  });
  it("adapts greetings to Sao Paulo send time", () => {
    expect(adaptGreeting("Bom dia, tudo bem?", new Date("2026-11-02T18:00:00Z"))).toBe("Boa tarde, tudo bem?");
    expect(adaptGreeting("Boa noite!", new Date("2026-11-02T15:00:00Z"))).toBe("Boa tarde!");
  });
});

describe("B-T6X numbered message blocks", () => {
  const numbered = [
    { when: "Abordagem inicial - mensagem 2", variants: ["Segundo bloco\n\ncom parágrafo preservado"] },
    { when: "Abordagem inicial - mensagem 1", variants: ["Primeiro bloco\n\ncom outro parágrafo"] },
    { when: "Cliente aceita - mensagem 2", variants: ["Etapa de aceite 2\n\nparágrafo interno"] },
    { when: "Cliente aceita - mensagem 1", variants: ["Etapa de aceite 1"] },
    { when: "Cliente aceita - mensagem 3", variants: ["Etapa de aceite 3"] },
  ];
  it("keeps paragraphs intact and orders numbered opening blocks", () => {
    const blocks = openingMessagesFor({ miner: { btx_opening: true }, btx: { rules: numbered } } as any);
    expect(blocks).toEqual(["Primeiro bloco\n\ncom outro parágrafo", "Segundo bloco\n\ncom parágrafo preservado"]);
  });
  it("sends all numbered messages in sequence when client accepts", () => {
    const first = sequenceReply([{ role: "assistant", content: "Abordagem inicial" }, { role: "user", content: "simm, claro!" }], numbered, {}, "Cliente");
    expect(first?.replies).toEqual(["Etapa de aceite 1", "Etapa de aceite 2\n\nparágrafo interno", "Etapa de aceite 3"]);
  });
});

describe("B-T6X generated funnel normalization", () => {
  it("turns sequential opening messages into separate numbered message cards", () => {
    const result = normalizeGeneratedBtxRules([
      { when: "Abordagem inicial", mode: "sequence" as const, variants: ["Primeiro balão", "Segundo balão", "Terceiro balão"] },
    ]);
    expect(result.map((r) => r.when)).toEqual([
      "Abordagem inicial — Mensagem 1",
      "Abordagem inicial — Mensagem 2",
      "Abordagem inicial — Mensagem 3",
    ]);
    expect(result.map((r) => r.variants)).toEqual([["Primeiro balão"], ["Segundo balão"], ["Terceiro balão"]]);
    const opening = openingMessagesFor({ miner: { btx_opening: true }, btx: { rules: result } } as any);
    expect(opening).toEqual(["Primeiro balão", "Segundo balão", "Terceiro balão"]);
  });
  it("turns customer-response sequences into separately numbered steps", () => {
    const result = normalizeGeneratedBtxRules([
      { when: "Cliente aceita receber a apresentação", mode: "sequence" as const, variants: ["Apresentação", "Enviar catálogo"] },
    ]);
    expect(result.map((r) => r.when)).toEqual([
      "Cliente aceita receber a apresentação — Passo 1",
      "Cliente aceita receber a apresentação — Passo 2",
    ]);
  });
  it("keeps equivalent alternatives together in one card", () => {
    const result = normalizeGeneratedBtxRules([
      { when: "Cliente pergunta o preço", mode: "alternatives" as const, variants: ["Opção A", "Opção B"] },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.variants).toEqual(["Opção A", "Opção B"]);
  });
});


describe("LIMP — Lista de Interrupção de Mensagens", () => {
  const limp = { enabled: true, entries: ["finanças", "Não quero receber mensagens", "Remova meu número"] };
  it("ignora assunto cadastrado mesmo com acentos e caixa diferentes", () => {
    expect(matchLimpMessage("Quero conversar sobre FINANCAS amanhã.", limp)).toBe("finanças");
  });
  it("reconhece frases cadastradas mesmo com pontuação diferente", () => {
    expect(matchLimpMessage("Não quero receber mensagens!", limp)).toBe("Não quero receber mensagens");
  });
  it("não bloqueia quando LIMP está desligado ou quando não há correspondência", () => {
    expect(matchLimpMessage("Quero saber o preço", { ...limp, enabled: false })).toBeNull();
    expect(matchLimpMessage("Quero saber o preço", limp)).toBeNull();
  });
});

describe("B-T6X duplicate numbering", () => {
  it("renumbers repeated stages without changing message content or paragraphs", () => {
    const rules = [
      { when: "Abordagem inicial — Mensagem 1", variants: ["Primeiro texto"] },
      { when: "Abordagem inicial — Mensagem 1", variants: ["Segundo texto\n\nparágrafo preservado"] },
      { when: "Abordagem inicial — Mensagem 3", variants: ["Terceiro texto"] },
      { when: "Cliente pergunta preço — Passo 1", variants: ["Preço"] },
    ];
    const result = normalizeBtxRuleNumbering(rules);
    expect(result.map((r) => r.when)).toEqual([
      "Abordagem inicial — Mensagem 1",
      "Abordagem inicial — Mensagem 2",
      "Abordagem inicial — Mensagem 3",
      "Cliente pergunta preço — Passo 1",
    ]);
    expect(result[1]?.variants[0]).toBe("Segundo texto\n\nparágrafo preservado");
  });

  it("continues numbering when the generated plan splits one opening into multiple groups", () => {
    const result = normalizeGeneratedBtxRules([
      { when: "Abordagem inicial", mode: "sequence", variants: ["Mensagem A", "Mensagem B"] },
      { when: "Abordagem inicial", mode: "sequence", variants: ["Mensagem C"] },
    ]);
    expect(result.map((r) => r.when)).toEqual([
      "Abordagem inicial — Mensagem 1",
      "Abordagem inicial — Mensagem 2",
      "Abordagem inicial — Mensagem 3",
    ]);
  });
});


describe("B-T6X sequence opening guard", () => {
  const rules = [{ when: "Cliente aceita continuar — Passo 1", mode: "sequence" as const, variants: ["Primeiro passo"] }];
  it("does not start an acceptance sequence after a non-opening objection response", () => {
    const result = sequenceReply([
      { role: "assistant", content: "Abordagem inicial" },
      { role: "user", content: "Quanto custa?" },
      { role: "assistant", content: "O valor depende do projeto." },
      { role: "user", content: "Sim" },
    ], rules, {}, "Cliente", true, ["Abordagem inicial"]);
    expect(result).toBeNull();
  });
  it("starts an acceptance sequence when the last assistant message is the configured opening", () => {
    const result = sequenceReply([
      { role: "assistant", content: "Abordagem inicial" },
      { role: "user", content: "Sim" },
    ], rules, {}, "Cliente", true, ["Abordagem inicial"]);
    expect(result?.replies).toEqual(["Primeiro passo"]);
  });
});


describe("Evolution fromMe flag", () => {
  it("does not mistake the string false for an outbound message", () => {
    expect(isFromMeFlag(false)).toBe(false);
    expect(isFromMeFlag("false")).toBe(false);
    expect(isFromMeFlag("0")).toBe(false);
  });
  it("recognizes true boolean and string values", () => {
    expect(isFromMeFlag(true)).toBe(true);
    expect(isFromMeFlag("true")).toBe(true);
    expect(isFromMeFlag(1)).toBe(true);
  });
});
