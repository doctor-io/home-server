import { describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword,
} from "@/lib/server/modules/auth/password";

describe("auth password helpers", () => {
  it("hashes and verifies password", async () => {
    const hash = await hashPassword("StrongPass123");

    expect(hash).toContain(":");
    await expect(verifyPassword("StrongPass123", hash)).resolves.toBe(true);
    await expect(verifyPassword("WrongPass123", hash)).resolves.toBe(false);
  });
});
