import { describe, expect, it } from "vitest";
import {
  buildSessionPayload,
  isSessionExpired,
  parseSessionToken,
} from "@/lib/shared/auth/session";

describe("shared auth session helpers", () => {
  it("builds and parses a session token", () => {
    const payload = buildSessionPayload("session-1", 1890000000);
    expect(payload).toBe("session-1.1890000000");

    const parsed = parseSessionToken("session-1.1890000000.signature");
    expect(parsed).toEqual({
      payload: "session-1.1890000000",
      sessionId: "session-1",
      expiresAtEpochSeconds: 1890000000,
      signature: "signature",
    });
  });

  it("returns null for invalid token", () => {
    expect(parseSessionToken("x.y")).toBeNull();
    expect(parseSessionToken("x.y.z.extra")).toBeNull();
    expect(parseSessionToken("x.not-a-number.z")).toBeNull();
  });

  it("detects expiration", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(isSessionExpired(nowSeconds - 1)).toBe(true);
    expect(isSessionExpired(nowSeconds + 3600)).toBe(false);
  });
});
