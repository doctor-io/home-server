import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("postgres pool", () => {
  beforeEach(() => {
    vi.resetModules();
    delete (globalThis as { __homeioPgPool?: unknown }).__homeioPgPool;
    delete (globalThis as { __homeioPgPoolErrorListenerAttached?: unknown }).__homeioPgPoolErrorListenerAttached;
    delete (globalThis as { __homeioPgPoolInitLogged?: unknown }).__homeioPgPoolInitLogged;
  });

  afterEach(() => {
    delete (globalThis as { __homeioPgPool?: unknown }).__homeioPgPool;
    delete (globalThis as { __homeioPgPoolErrorListenerAttached?: unknown }).__homeioPgPoolErrorListenerAttached;
    delete (globalThis as { __homeioPgPoolInitLogged?: unknown }).__homeioPgPoolInitLogged;
  });

  it("creates a pool using server env", async () => {
    const poolInstance = { query: vi.fn(), on: vi.fn() };
    const Pool = vi.fn(
      class MockPool {
        constructor() {
          return poolInstance as unknown as MockPool;
        }
      },
    );

    vi.doMock("pg", () => ({ Pool }));
    vi.doMock("@/lib/server/env", () => ({
      serverEnv: {
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/home_server",
        PG_MAX_CONNECTIONS: 3,
        LOG_LEVEL: "info",
        LOG_FILE_PATH: "logs/home-server.log",
        LOG_TO_FILE: true,
      },
    }));

    const { pgPool } = await import("@/lib/server/db/postgres");

    expect(pgPool).toBe(poolInstance);
    expect(Pool).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: "postgresql://test:test@127.0.0.1:5432/home_server",
        max: 3,
      }),
    );
    expect(poolInstance.on).toHaveBeenCalledWith("error", expect.any(Function));
  });

  it("reuses global pool in non-production", async () => {
    const existing = { query: vi.fn(), on: vi.fn() };
    (globalThis as { __homeioPgPool?: unknown }).__homeioPgPool = existing;

    const Pool = vi.fn(class MockPool {});
    vi.doMock("pg", () => ({ Pool }));
    vi.doMock("@/lib/server/env", () => ({
      serverEnv: {
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/home_server",
        PG_MAX_CONNECTIONS: 3,
        LOG_LEVEL: "info",
        LOG_FILE_PATH: "logs/home-server.log",
        LOG_TO_FILE: true,
      },
    }));

    const { pgPool } = await import("@/lib/server/db/postgres");

    expect(pgPool).toBe(existing);
    expect(Pool).not.toHaveBeenCalled();
    expect(existing.on).toHaveBeenCalledWith("error", expect.any(Function));
  });
});
