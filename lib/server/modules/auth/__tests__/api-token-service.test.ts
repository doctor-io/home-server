import { describe, expect, it } from "vitest";
import {
  generateApiToken,
  hasScope,
  hashToken,
  isExpired,
  isUsable,
  normalizeScopes,
  prefixOf,
  verifyToken,
} from "@/lib/server/modules/auth/api-token-service";
import { isStale, type ApiToken } from "@/lib/shared/contracts/api-tokens";

describe("generateApiToken", () => {
  it("issues a recognisable, URL-safe token", async () => {
    const generated = await generateApiToken();

    expect(generated.token.startsWith("homeio_")).toBe(true);
    // base64url, so it survives a header or a config file unescaped.
    expect(generated.token).toMatch(/^homeio_[A-Za-z0-9_-]+$/);
    expect(generated.token.length).toBeGreaterThan(40);
  });

  it("never repeats", async () => {
    const [a, b] = await Promise.all([generateApiToken(), generateApiToken()]);

    expect(a.token).not.toBe(b.token);
    expect(a.prefix).not.toBe(b.prefix);
  });

  it("stores a hash, not the token", async () => {
    const generated = await generateApiToken();

    expect(generated.tokenHash).not.toContain(generated.token);
    await expect(verifyToken(generated.token, generated.tokenHash)).resolves.toBe(true);
  });

  it("derives the prefix from the token itself", async () => {
    const generated = await generateApiToken();

    expect(prefixOf(generated.token)).toBe(generated.prefix);
    expect(generated.token.startsWith(generated.prefix)).toBe(true);
  });
});

describe("verifyToken", () => {
  it("rejects the wrong token", async () => {
    const hash = await hashToken("homeio_correct");

    await expect(verifyToken("homeio_wrong", hash)).resolves.toBe(false);
  });

  it("rejects a malformed stored hash instead of throwing", async () => {
    await expect(verifyToken("homeio_x", "not-a-hash")).resolves.toBe(false);
    await expect(verifyToken("homeio_x", "")).resolves.toBe(false);
  });
});

describe("normalizeScopes", () => {
  it("keeps only scopes that exist", async () => {
    expect(normalizeScopes(["read:apps", "root:everything", "write:files"])).toEqual([
      "read:apps",
      "write:files",
    ]);
  });

  it("deduplicates", () => {
    expect(normalizeScopes(["read:apps", "read:apps"])).toEqual(["read:apps"]);
  });

  it("treats anything that is not a list as no scopes at all", () => {
    expect(normalizeScopes("read:apps")).toEqual([]);
    expect(normalizeScopes(null)).toEqual([]);
  });
});

describe("usability", () => {
  const now = new Date("2026-08-30T12:00:00Z");

  it("treats a token with no expiry as never expiring", () => {
    expect(isExpired(null, now)).toBe(false);
  });

  it("expires at the moment stated, not after it", () => {
    expect(isExpired(now, now)).toBe(true);
  });

  it("refuses a revoked token even before its expiry", () => {
    const later = new Date(now.getTime() + 86_400_000).toISOString();

    expect(isUsable({ revokedAt: now.toISOString(), expiresAt: later }, now)).toBe(false);
  });

  it("accepts a live token", () => {
    const later = new Date(now.getTime() + 86_400_000).toISOString();

    expect(isUsable({ revokedAt: null, expiresAt: later }, now)).toBe(true);
  });
});

describe("hasScope", () => {
  it("grants nothing that was not asked for", () => {
    expect(hasScope(["read:apps"], "write:apps")).toBe(false);
    expect(hasScope(["read:apps"], "read:apps")).toBe(true);
  });

  it("does not treat write as implying read", () => {
    // Scopes are flat on purpose: an implied grant is one nobody reviewed.
    expect(hasScope(["write:apps"], "read:apps")).toBe(false);
  });
});

describe("isStale", () => {
  const now = new Date("2026-08-30T12:00:00Z");

  function token(overrides: Partial<ApiToken> = {}): ApiToken {
    return {
      id: "t1",
      name: "Home Assistant",
      prefix: "homeio_ab",
      scopes: ["read:metrics"],
      expiresAt: null,
      lastUsedAt: null,
      lastUsedIp: null,
      createdAt: now.toISOString(),
      revokedAt: null,
      ...overrides,
    };
  }

  it("flags a token unused for 90 days", () => {
    const old = new Date(now.getTime() - 91 * 86_400_000).toISOString();

    expect(isStale(token({ createdAt: old }), now)).toBe(true);
  });

  it("counts recent use rather than age", () => {
    const old = new Date(now.getTime() - 200 * 86_400_000).toISOString();
    const recent = new Date(now.getTime() - 86_400_000).toISOString();

    expect(isStale(token({ createdAt: old, lastUsedAt: recent }), now)).toBe(false);
  });

  it("does not nag about a token that is already revoked", () => {
    const old = new Date(now.getTime() - 200 * 86_400_000).toISOString();

    expect(isStale(token({ createdAt: old, revokedAt: old }), now)).toBe(false);
  });
});
