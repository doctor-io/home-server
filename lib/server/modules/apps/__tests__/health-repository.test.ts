import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/db/drizzle", () => ({
  db: { select: vi.fn(), insert: vi.fn(), delete: vi.fn() },
}));

import { db } from "@/lib/server/db/drizzle";
import {
  defaultHealth,
  findAppHealth,
  recordAppHealthState,
  saveAppHealthPolicy,
} from "@/lib/server/modules/apps/health-repository";

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  for (const method of ["from", "where", "limit"]) chain[method] = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve);
  return chain;
}

function captureInsert() {
  const captured: { values?: Record<string, unknown>; set?: Record<string, unknown> } = {};
  vi.mocked(db.insert).mockReturnValue({
    values: (values: Record<string, unknown>) => {
      captured.values = values;
      return {
        onConflictDoUpdate: ({ set }: { set: Record<string, unknown> }) => {
          captured.set = set;
          return Promise.resolve();
        },
      };
    },
  } as never);
  return captured;
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    appId: "jellyfin",
    restartPolicy: "on-failure",
    maxRestarts: 5,
    windowMinutes: 10,
    state: "healthy",
    restartCount: 2,
    windowStartedAt: new Date("2026-08-30T10:00:00Z"),
    lastTransitionAt: new Date("2026-08-30T10:05:00Z"),
    mutedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("app health repository", () => {
  it("maps a stored row", async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([row()]) as never);

    await expect(findAppHealth("jellyfin")).resolves.toMatchObject({
      appId: "jellyfin",
      policy: "on-failure",
      state: "healthy",
      restartCount: 2,
      windowStartedAt: "2026-08-30T10:00:00.000Z",
    });
  });

  it("returns null when an app has never been configured", async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as never);

    await expect(findAppHealth("jellyfin")).resolves.toBeNull();
  });

  it("falls back to leaving the container alone on an unrecognised policy", async () => {
    // A corrupt row must not be read as permission to restart something.
    vi.mocked(db.select).mockReturnValue(makeSelectChain([row({ restartPolicy: "wat" })]) as never);

    await expect(findAppHealth("jellyfin")).resolves.toMatchObject({ policy: "no" });
  });

  it("falls back to unknown on an unrecognised state", async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([row({ state: "sideways" })]) as never);

    await expect(findAppHealth("jellyfin")).resolves.toMatchObject({ state: "unknown" });
  });

  it("defaults an unconfigured app to no restarts", () => {
    expect(defaultHealth("jellyfin")).toMatchObject({
      policy: "no",
      state: "unknown",
      restartCount: 0,
    });
  });

  it("writes the policy without touching live counters", async () => {
    const captured = captureInsert();

    await saveAppHealthPolicy("jellyfin", { policy: "always", maxRestarts: 3, windowMinutes: 5 });

    expect(captured.set).toMatchObject({
      restartPolicy: "always",
      maxRestarts: 3,
      windowMinutes: 5,
    });
    // A settings save must not reset what the watchdog has observed.
    expect(captured.set).not.toHaveProperty("state");
    expect(captured.set).not.toHaveProperty("restartCount");
  });

  it("writes observed state without touching the policy", async () => {
    const captured = captureInsert();

    await recordAppHealthState({ appId: "jellyfin", state: "restarting", restartCount: 3 });

    expect(captured.set).toMatchObject({ state: "restarting", restartCount: 3 });
    expect(captured.set).not.toHaveProperty("restartPolicy");
    expect(captured.set).not.toHaveProperty("maxRestarts");
  });

  it("leaves the restart count alone when the watchdog does not supply one", async () => {
    const captured = captureInsert();

    await recordAppHealthState({ appId: "jellyfin", state: "healthy" });

    expect(captured.set).not.toHaveProperty("restartCount");
  });
});
