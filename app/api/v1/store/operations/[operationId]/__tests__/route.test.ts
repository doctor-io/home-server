import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/store/operations", () => ({
  getStoreOperation: vi.fn(),
}));

import { GET } from "@/app/api/v1/store/operations/[operationId]/route";
import { getStoreOperation } from "@/lib/server/modules/store/operations";

describe("GET /api/v1/store/operations/:operationId", () => {
  it("returns operation snapshot", async () => {
    vi.mocked(getStoreOperation).mockResolvedValueOnce({
      id: "op-1",
      appId: "homepage",
      action: "install",
      status: "running",
      progressPercent: 44,
      currentStep: "pull-images",
      errorMessage: null,
      startedAt: "2026-02-23T00:00:00.000Z",
      finishedAt: null,
      updatedAt: "2026-02-23T00:00:30.000Z",
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({
        operationId: "op-1",
      }),
    });
    const json = (await response.json()) as { data: { id: string } };

    expect(response.status).toBe(200);
    expect(json.data.id).toBe("op-1");
  });

  it("returns 404 when missing", async () => {
    vi.mocked(getStoreOperation).mockResolvedValueOnce(null);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({
        operationId: "missing",
      }),
    });

    expect(response.status).toBe(404);
  });
});
