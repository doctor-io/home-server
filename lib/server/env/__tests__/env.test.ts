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
    expect(serverEnv.STORE_STACKS_ROOT).toBe("DATA/AppData");
    expect(serverEnv.STORE_MAX_CONCURRENT_OPERATIONS).toBe(3);
    expect(serverEnv.STORE_APP_DATA_ROOT).toBe("DATA/AppData");
    expect(serverEnv.FILES_ROOT).toBe("DATA");
    expect(serverEnv.FILES_ALLOW_HIDDEN).toBe(false);
    expect(serverEnv.TERMINAL_WS_REQUIRE_AUTH).toBe(true);
    expect(serverEnv.TERMINAL_MAX_SESSIONS_PER_USER).toBe(2);
    expect(serverEnv.TERMINAL_IDLE_TIMEOUT_MS).toBe(900000);
    expect(serverEnv.TERMINAL_MAX_SESSION_MS).toBe(3600000);
  });

  it("uses /DATA/AppData as default stacks root in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_SESSION_SECRET = "a-valid-production-session-secret";
    delete process.env.STORE_STACKS_ROOT;
    delete process.env.STORE_APP_DATA_ROOT;
    delete process.env.FILES_ROOT;

    const { serverEnv } = await import("@/lib/server/env");

    expect(serverEnv.STORE_STACKS_ROOT).toBe("/DATA/AppData");
    expect(serverEnv.STORE_APP_DATA_ROOT).toBe("/DATA/AppData");
    expect(serverEnv.FILES_ROOT).toBe("/DATA");
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

  it("parses STORE_MAX_CONCURRENT_OPERATIONS", async () => {
    process.env.STORE_MAX_CONCURRENT_OPERATIONS = "7";

    const { serverEnv } = await import("@/lib/server/env");

    expect(serverEnv.STORE_MAX_CONCURRENT_OPERATIONS).toBe(7);
  });

  it("allows the default session secret outside production", async () => {
    process.env.NODE_ENV = "development";
    process.env.AUTH_SESSION_SECRET = "dev-session-secret-change-me";

    const { serverEnv } = await import("@/lib/server/env");

    expect(serverEnv.AUTH_SESSION_SECRET).toBe("dev-session-secret-change-me");
  });

  it("rejects default session secrets in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_SESSION_SECRET = "change-me-to-a-random-32-char-secret";

    await expect(import("@/lib/server/env")).rejects.toThrow(
      "AUTH_SESSION_SECRET must be a non-default value",
    );
  });

  it("rejects short session secrets in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_SESSION_SECRET = "short-secret-over-16";

    await expect(import("@/lib/server/env")).rejects.toThrow(
      "AUTH_SESSION_SECRET must be a non-default value",
    );
  });
});
