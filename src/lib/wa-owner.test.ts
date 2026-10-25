import { describe, expect, it } from "vitest";
import { canUse } from "./wa-owner";

const me = "19fad30e-44ab-4b9b-b400-8bd39f9d38dc";
const other = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("WhatsApp instance ownership", () => {
  it("owner can use own app instance", () => expect(canUse(me, false, "br19fad30e44-vendas-ab12")).toBe(true));
  it("nobody uses another account's app instance, not even admin", () =>
    expect(canUse(me, true, `br${other.replace(/-/g, "").slice(0, 10)}-x-1`)).toBe(false));
  it("admin can use numbers created directly on the server", () => expect(canUse(me, true, "lucas-bfd0f2-7rl3")).toBe(true));
  it("regular account cannot use server numbers", () => expect(canUse(me, false, "lucas-bfd0f2-7rl3")).toBe(false));
});
