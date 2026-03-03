import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/db/drizzle", () => ({
  db: {
    execute: vi.fn(),
    select: vi.fn(),
  },
}));

import { db } from "@/lib/server/db/drizzle";
import { hasAnyUsers } from "@/lib/server/modules/auth/repository";

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

describe("auth repository", () => {
  beforeEach(() => {
    vi.mocked(db.execute).mockReset();
    vi.mocked(db.select).mockReset();
  });

  it("returns false when users table does not exist", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce({
      rows: [{ table_exists: null }],
    } as never);

    await expect(hasAnyUsers()).resolves.toBe(false);
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it("returns true when users table exists and has rows", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce({
      rows: [{ table_exists: "users" }],
    } as never);

    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([{ total: 1 }]) as never,
    );

    await expect(hasAnyUsers()).resolves.toBe(true);
  });
});
