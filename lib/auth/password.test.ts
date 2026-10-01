import { describe, expect, it } from "vitest";
import { hashPassword, validatePassword, verifyPassword } from "./password";

describe("password security", () => {
  it("hashes and verifies passwords without storing plaintext", () => {
    const hash = hashPassword("StrongPass2026");
    expect(hash).not.toContain("StrongPass2026");
    expect(verifyPassword("StrongPass2026", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
  });

  it("enforces the minimum password policy", () => {
    expect(validatePassword("short")).not.toBeNull();
    expect(validatePassword("StrongPass2026")).toBeNull();
  });
});
