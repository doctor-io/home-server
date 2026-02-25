import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/db/query", () => ({
  timedPgQuery: vi.fn(),
}));

import { timedPgQuery } from "@/lib/server/db/query";
import {
  findStoreOperationById,
  listInstalledStacksFromDb,
} from "@/lib/server/modules/apps/stacks-repository";

describe("store repository", () => {
  const queryMock = vi.mocked(timedPgQuery);

  beforeEach(() => {
    queryMock.mockReset();
  });

  it("returns empty stacks list when app_stacks table is absent", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ table_exists: null }],
    } as never);

    const result = await listInstalledStacksFromDb();

    expect(result).toEqual([]);
  });

  it("maps operation row from database contract", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ table_exists: "app_operations" }],
    } as never);
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: "op-1",
          app_id: "adguard-home",
          action: "install",
          status: "running",
          progress_percent: 46,
          current_step: "pull-images",
          error_message: null,
          started_at: new Date("2026-02-23T00:00:00.000Z"),
          finished_at: null,
          updated_at: "2026-02-23T00:01:00.000Z",
        },
      ],
    } as never);

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
