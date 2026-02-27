import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = process.env;

describe("server env", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("loads defaults when optional variables are absent", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.PG_MAX_CONNECTIONS;
    delete process.env.METRICS_CACHE_TTL_MS;
    delete process.env.STORE_STACKS_ROOT;

    const { serverEnv } = await import("@/lib/server/env");

    expect(serverEnv.DATABASE_URL).toContain("postgresql://");
    expect(serverEnv.PG_MAX_CONNECTIONS).toBe(10);
    expect(serverEnv.WEBSOCKET_ENABLED).toBe(true);
    expect(serverEnv.AUTH_COOKIE_SECURE).toBe(false);
    expect(serverEnv.STORE_STACKS_ROOT).toBe("DATA/Apps");
    expect(serverEnv.FILES_ROOT).toBe("DATA");
    expect(serverEnv.FILES_ALLOW_HIDDEN).toBe(false);
  });

  it("uses /DATA/Apps as default stacks root in production", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.STORE_STACKS_ROOT;
    delete process.env.FILES_ROOT;

    const { serverEnv } = await import("@/lib/server/env");

    expect(serverEnv.STORE_STACKS_ROOT).toBe("/DATA/Apps");
    expect(serverEnv.FILES_ROOT).toBe("/DATA");
  });

  it("parses AUTH_COOKIE_SECURE=true", async () => {
    process.env.AUTH_COOKIE_SECURE = "true";

    const { serverEnv } = await import("@/lib/server/env");

    expect(serverEnv.AUTH_COOKIE_SECURE).toBe(true);
  });

  it("parses FILES_ALLOW_HIDDEN=true", async () => {
    process.env.FILES_ALLOW_HIDDEN = "true";

    const { serverEnv } = await import("@/lib/server/env");

    expect(serverEnv.FILES_ALLOW_HIDDEN).toBe(true);
  });

  it("throws for invalid database url", async () => {
    process.env.DATABASE_URL = "not-a-url";

    await expect(import("@/lib/server/env")).rejects.toThrow(
      "Invalid server environment",
    );
  });
});
