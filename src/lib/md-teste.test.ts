import { describe, it, expect, vi } from "vitest";

const evoSend = vi.fn(), evoSendAudio = vi.fn();
vi.mock("@/lib/evolution.server", () => ({ evoSend, evoSendAudio }));
vi.mock("@/lib/mining-options", async () => await import("./mining-options"));

import { openingFor, citiesFor, processAgentQueue, runAgentTool } from "./agents.server";

// cliente falso do banco: devolve as linhas pedidas e registra updates
function fakeDb(tables: Record<string, any[]>) {
  const updates: any[] = [];
  const q = (t: string) => {
    let rows = tables[t] ?? []; let upd: any = null;
    const api: any = {
      select: () => api, eq: (k: string, v: any) => { rows = rows.filter((r) => r[k] === undefined || r[k] === v); return api; },
      lte: () => api, gte: () => api, order: () => api, limit: () => api, in: () => api, like: () => api,
      update: (u: any) => { upd = u; updates.push({ t, u }); return api; },
      insert: () => Promise.resolve({ data: null }),
      single: () => Promise.resolve({ data: rows[0] ?? null }), maybeSingle: () => Promise.resolve({ data: rows[0] ?? null }),
      then: (f: any) => Promise.resolve({ data: upd ? rows.map((r) => ({ id: r.id })) : rows, count: 0 }).then(f),
    };
    return api;
  };
  return { sb: { from: q } as any, updates };
}

const agent = (miner: any, extra: any = {}) => ({ id: "a1", user_id: "u", name: "X", active: true, instance: "inst", script_steps: [{ title: "", goal: "", message: "roteiro antigo" }], btx: { rules: [{ when: "Abordagem inicial", variants: ["Oi {nome}, tudo bem?"] }, { when: "Não quer", variants: ["Tranquilo!"] }] }, miner, ...extra });

describe("md-teste e abordagem", () => {
  it("abordagem inicial usa o B-T6X quando ligado", () => {
    expect(openingFor(agent({ btx_opening: true }) as any)).toBe("Oi {nome}, tudo bem?");
  });
  it("sem B-T6X ligado usa o roteiro", () => {
    expect(openingFor(agent({}) as any)).toBe("roteiro antigo");
  });
  it("mineração só usa cidades dos estados marcados", async () => {
    const c = await citiesFor({ states: ["AC", "RO"] });
    expect(c.sort()).toEqual(["Porto Velho, RO", "Rio Branco, AC"]);
  });
  it("cidade pedida fora dos estados marcados é ignorada", async () => {
    const c = await citiesFor({ states: ["AC"] }, "São Paulo");
    expect(c).toEqual(["Rio Branco, AC"]);
  });
  it("md-teste: fila não envia mensagem", async () => {
    evoSend.mockClear();
    const a = agent({ md_teste: true, hora_inicio: 0, hora_fim: 24 });
    const { sb } = fakeDb({ agent_leads: [{ id: "l1", agent_id: "a1", status: "fila", phone: "5568999999999", name: "Loja" }], agents: [a], agent_events: [] });
    const sent = await processAgentQueue(sb);
    expect(sent).toBe(0);
    expect(evoSend).not.toHaveBeenCalled();
  });
  it("md-teste: ferramenta enviar_mensagem não envia", async () => {
    evoSend.mockClear();
    const { sb } = fakeDb({ agent_events: [] });
    const r: any = await runAgentTool(sb, agent({ md_teste: true }) as any, "enviar_mensagem", { telefone: "5568999999999", texto: "oi" });
    expect(r.teste).toBe(true);
    expect(evoSend).not.toHaveBeenCalled();
  });
});
