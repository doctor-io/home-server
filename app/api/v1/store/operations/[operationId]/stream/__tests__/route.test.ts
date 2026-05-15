import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/env", () => ({
  serverEnv: {
    SSE_HEARTBEAT_MS: 60_000,
  },
}));

vi.mock("@/lib/server/modules/auth/service", () => ({
  authenticateSession: vi.fn(),
}));

vi.mock("@/lib/server/modules/auth/cookies", () => ({
  getAuthCookieName: () => "homeio_session",
}));

vi.mock("@/lib/server/modules/apps/operations", () => ({
  getLatestStoreOperationEvent: vi.fn(),
  getStoreOperation: vi.fn(),
  subscribeToStoreOperation: vi.fn(),
}));

import { GET } from "@/app/api/v1/store/operations/[operationId]/stream/route";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import {
  getLatestStoreOperationEvent,
  getStoreOperation,
  subscribeToStoreOperation,
} from "@/lib/server/modules/apps/operations";
import type { StoreOperationEvent } from "@/lib/shared/contracts/apps";

const validSession = {
  sessionId: "s1",
  userId: "u1",
  username: "ahmed",
  passwordHash: "hash",
  expiresAt: new Date(Date.now() + 60_000),
};

describe("GET /api/v1/store/operations/:operationId/stream", () => {
  it("returns 401 for unauthenticated requests", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce(null);

    const response = await GET(new NextRequest("http://localhost"), {
      params: Promise.resolve({ operationId: "op-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("streams operation events as SSE for authenticated user", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce(validSession);
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

    const response = await GET(
      new NextRequest("http://localhost", {
        headers: { cookie: "homeio_session=session-token" },
      }),
      {
        params: Promise.resolve({
          operationId: "op-1",
        }),
      },
    );

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
