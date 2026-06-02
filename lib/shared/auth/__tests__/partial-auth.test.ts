import { describe, expect, it } from "vitest";
import {
  PARTIAL_AUTH_TOKEN_PREFIX,
  buildPartialAuthPayload,
  isPartialAuthExpired,
  parsePartialAuthToken,
} from "@/lib/shared/auth/partial-auth";

describe("shared partial-auth helpers", () => {
  it("builds the prefixed payload string", () => {
    expect(buildPartialAuthPayload("user-1", 1890000000)).toBe(
      `${PARTIAL_AUTH_TOKEN_PREFIX}.user-1.1890000000`,
    );
  });

  it("parses a well-formed token", () => {
    const parsed = parsePartialAuthToken(
      `${PARTIAL_AUTH_TOKEN_PREFIX}.user-1.1890000000.deadbeef`,
    );
    expect(parsed).toEqual({
      payload: `${PARTIAL_AUTH_TOKEN_PREFIX}.user-1.1890000000`,
      userId: "user-1",
      expiresAtEpochSeconds: 1890000000,
      signature: "deadbeef",
    });
  });

  it("rejects tokens with the wrong prefix segment", () => {
    // A session-token-shaped value must NOT parse as a partial-auth token,
    // even if it happens to have 4 dot-segments by accident.
    expect(parsePartialAuthToken("session-1.1890000000.sig.x")).toBeNull();
  });

  it("rejects tokens with the wrong segment count", () => {
    expect(parsePartialAuthToken("partial.user-1.1890000000")).toBeNull();
    expect(
      parsePartialAuthToken("partial.user-1.1890000000.sig.extra"),
    ).toBeNull();
  });

  it("rejects tokens with non-numeric expiry", () => {
    expect(
      parsePartialAuthToken("partial.user-1.not-a-number.sig"),
    ).toBeNull();
  });

  it("rejects tokens with empty fields", () => {
    expect(parsePartialAuthToken("partial..1890000000.sig")).toBeNull();
    expect(parsePartialAuthToken("partial.user-1.1890000000.")).toBeNull();
  });

  it("detects expiration off the current clock", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(isPartialAuthExpired(nowSeconds - 1)).toBe(true);
    expect(isPartialAuthExpired(nowSeconds + 60)).toBe(false);
  });
});
