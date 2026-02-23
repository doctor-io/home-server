import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/store/service", () => ({
  startAppLifecycleAction: vi.fn(),
}));

import { POST } from "@/app/api/v1/store/apps/[appId]/redeploy/route";
import { startAppLifecycleAction } from "@/lib/server/modules/store/service";

describe("POST /api/v1/store/apps/:appId/redeploy", () => {
  it("starts a redeploy operation", async () => {
    vi.mocked(startAppLifecycleAction).mockResolvedValueOnce({
      operationId: "op-redeploy",
    });

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          env: {
            TZ: "Africa/Tunis",
          },
          webUiPort: 3100,
        }),
      }),
      {
        params: Promise.resolve({
          appId: "homepage",
        }),
      },
    );

    const json = (await response.json()) as { operationId: string };

    expect(response.status).toBe(202);
    expect(json.operationId).toBe("op-redeploy");
    expect(startAppLifecycleAction).toHaveBeenCalledWith({
      appId: "homepage",
      action: "redeploy",
      env: {
        TZ: "Africa/Tunis",
      },
      webUiPort: 3100,
    });
  });
});
