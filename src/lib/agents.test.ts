import { describe, it, expect } from "vitest";
import { paceDelayMs, fillTemplate, splitBubbles, matchBtxRule, matchPositiveBtxRule, sequenceReply, adaptGreeting, isEmailOrForwardRequest, openingMessagesFor } from "./agents.server";

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
  it("adapts greetings to Rio Branco send time", () => {
    expect(adaptGreeting("Bom dia, tudo bem?", new Date("2026-11-02T18:00:00Z"))).toBe("Boa tarde, tudo bem?");
    expect(adaptGreeting("Boa noite!", new Date("2026-11-02T15:00:00Z"))).toBe("Bom dia!");
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
