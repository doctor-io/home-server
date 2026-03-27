import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/db/drizzle", () => ({
  db: {
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
    vi.mocked(db.select).mockReset();
  });

  it("returns false when the users table is empty", async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([{ total: 0 }]) as never,
    );

    await expect(hasAnyUsers()).resolves.toBe(false);
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it("returns true when the users table has at least one row", async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([{ total: 1 }]) as never,
    );

    await expect(hasAnyUsers()).resolves.toBe(true);
  });
});
