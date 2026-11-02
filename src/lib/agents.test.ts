import { describe, it, expect } from "vitest";
import { paceDelayMs, fillTemplate, splitBubbles, matchBtxRule } from "./agents.server";

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
