import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
const expect = (value: unknown) => ({ toBe: (expected: unknown) => assert.equal(value, expected) });
import { canUsePanel, canManageAccess } from "./access-policy";
describe("account approval", () => {
  it("new pending accounts cannot use the panel", () => { expect(canUsePanel("pending")).toBe(false); });
  it("rejected accounts cannot use the panel", () => { expect(canUsePanel("rejected")).toBe(false); });
  it("approved accounts can use the panel", () => { expect(canUsePanel("approved")).toBe(true); });
  it("missing approval fails closed", () => { expect(canUsePanel(undefined)).toBe(false); });
  it("normal approved accounts cannot manage ACESS", () => { expect(canManageAccess(false, "approved")).toBe(false); });
  it("only approved administrators can manage ACESS", () => { expect(canManageAccess(true, "approved")).toBe(true); expect(canManageAccess(true, "pending")).toBe(false); });
});