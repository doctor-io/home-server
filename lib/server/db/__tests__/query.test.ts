import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/db/postgres", () => ({
  pgPool: {
    query: vi.fn(),
  },
}));

import { pgPool } from "@/lib/server/db/postgres";
import { timedPgQuery } from "@/lib/server/db/query";

describe("timedPgQuery", () => {
  it("executes pool query and returns result", async () => {
    vi.mocked(pgPool.query).mockResolvedValueOnce({
      command: "SELECT",
      rowCount: 1,
      rows: [{ id: "1" }],
    } as never);

    const result = await timedPgQuery<{ id: string }>("SELECT 1");

    expect(pgPool.query).toHaveBeenCalledWith("SELECT 1", undefined);
    expect(result.rows).toEqual([{ id: "1" }]);
  });
});
