import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/db/drizzle", () => ({
  db: {
    execute: vi.fn(),
    select: vi.fn(),
  },
}));

import { db } from "@/lib/server/db/drizzle";
import {
  findStoreOperationById,
  listInstalledStacksFromDb,
} from "@/lib/server/modules/apps/stacks-repository";

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  for (const method of ["from", "where", "orderBy", "limit", "innerJoin"]) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve);
  chain.catch = (reject: (r: unknown) => unknown) => Promise.resolve(rows).catch(reject);
  chain.finally = (cb: () => void) => Promise.resolve(rows).finally(cb);
  return chain;
}

describe("store repository", () => {
  beforeEach(() => {
    vi.mocked(db.execute).mockReset();
    vi.mocked(db.select).mockReset();
  });

  it("returns empty stacks list when app_stacks table is absent", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce({
      rows: [{ table_exists: null }],
    } as never);

    const result = await listInstalledStacksFromDb();

    expect(result).toEqual([]);
  });

  it("maps operation row from database contract", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce({
      rows: [{ table_exists: "app_operations" }],
    } as never);

    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([
        {
          id: "op-1",
          appId: "adguard-home",
          action: "install",
          status: "running",
          progressPercent: 46,
          currentStep: "pull-images",
          errorMessage: null,
          startedAt: new Date("2026-02-23T00:00:00.000Z"),
          finishedAt: null,
          updatedAt: new Date("2026-02-23T00:01:00.000Z"),
        },
      ]) as never,
    );

    const result = await findStoreOperationById("op-1");

    expect(result).toEqual({
      id: "op-1",
      appId: "adguard-home",
      action: "install",
      status: "running",
      progressPercent: 46,
      currentStep: "pull-images",
      errorMessage: null,
      startedAt: "2026-02-23T00:00:00.000Z",
      finishedAt: null,
      updatedAt: "2026-02-23T00:01:00.000Z",
    });
  });
});
