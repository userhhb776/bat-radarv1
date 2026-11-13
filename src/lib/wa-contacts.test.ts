import { describe, expect, it } from "vitest";
import { contactMatches, parseContacts } from "./wa-contacts";

describe("consulta temporária de contatos", () => {
  it("busca por nome sem exigir acentos", () => {
    expect(contactMatches({ name: "João Silva", number: "5511999999999" }, "joao")).toBe(true);
    expect(contactMatches({ name: "Maria", number: "5511888888888" }, "joao")).toBe(false);
  });
  it("busca pelo número com formatação", () => {
    expect(contactMatches({ name: "Contato", number: "5511999999999" }, "(11) 99999-9999")).toBe(true);
  });
  it("exclui grupos e não repete contatos", () => {
    expect(parseContacts([{ remoteJid: "5511999999999@s.whatsapp.net", pushName: "João" }, { remoteJid: "123@g.us", name: "Grupo" }, { remoteJid: "5511999999999@s.whatsapp.net", pushName: "João" }])).toEqual([{ number: "5511999999999", name: "João" }]);
  });
});