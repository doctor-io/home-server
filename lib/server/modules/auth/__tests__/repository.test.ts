import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/db/query", () => ({
  timedPgQuery: vi.fn(),
}));

import { timedPgQuery } from "@/lib/server/db/query";
import { hasAnyUsers } from "@/lib/server/modules/auth/repository";

describe("auth repository", () => {
  it("returns false when users table does not exist", async () => {
    vi.mocked(timedPgQuery).mockResolvedValueOnce({
      rows: [{ exists: false }],
    } as never);

    await expect(hasAnyUsers()).resolves.toBe(false);
    expect(timedPgQuery).toHaveBeenCalledTimes(1);
  });

  it("returns true when users table exists and has rows", async () => {
    vi.mocked(timedPgQuery)
      .mockResolvedValueOnce({
        rows: [{ exists: true }],
      } as never)
      .mockResolvedValueOnce({
        rows: [{ total: 1 }],
      } as never);

    await expect(hasAnyUsers()).resolves.toBe(true);
    expect(timedPgQuery).toHaveBeenCalledTimes(2);
  });
});
