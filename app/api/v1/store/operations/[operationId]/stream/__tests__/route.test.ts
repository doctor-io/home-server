import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/env", () => ({
  serverEnv: {
    SSE_HEARTBEAT_MS: 60_000,
  },
}));

vi.mock("@/lib/server/modules/apps/operations", () => ({
  getLatestStoreOperationEvent: vi.fn(),
  getStoreOperation: vi.fn(),
  subscribeToStoreOperation: vi.fn(),
}));

import { GET } from "@/app/api/v1/store/operations/[operationId]/stream/route";
import {
  getLatestStoreOperationEvent,
  getStoreOperation,
  subscribeToStoreOperation,
} from "@/lib/server/modules/apps/operations";
import type { StoreOperationEvent } from "@/lib/shared/contracts/apps";

describe("GET /api/v1/store/operations/:operationId/stream", () => {
  it("streams operation events as SSE", async () => {
    vi.mocked(getStoreOperation).mockResolvedValueOnce({
      id: "op-1",
      appId: "homepage",
      action: "install",
      status: "running",
      progressPercent: 20,
      currentStep: "pull-images",
      errorMessage: null,
      startedAt: "2026-02-23T00:00:00.000Z",
      finishedAt: null,
      updatedAt: "2026-02-23T00:00:02.000Z",
    });
    vi.mocked(getLatestStoreOperationEvent).mockReturnValueOnce(null);

    vi.mocked(subscribeToStoreOperation).mockImplementation((_operationId, callback) => {
      const event: StoreOperationEvent = {
        type: "operation.completed",
        operationId: "op-1",
        appId: "homepage",
        action: "install",
        status: "success",
        progressPercent: 100,
        step: "completed",
        timestamp: "2026-02-23T00:00:03.000Z",
      };
      setTimeout(() => callback(event), 0);
      return () => undefined;
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({
        operationId: "op-1",
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    const reader = response.body?.getReader();
    expect(reader).toBeTruthy();

    const first = await reader?.read();
    const second = await reader?.read();
    const text =
      new TextDecoder().decode(first?.value ?? new Uint8Array()) +
      new TextDecoder().decode(second?.value ?? new Uint8Array());

    expect(text).toContain("event: operation.step");
    expect(text).toContain("event: operation.completed");
  });
});
