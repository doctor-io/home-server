import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/store/service", () => ({
  startAppLifecycleAction: vi.fn(),
}));

import { POST } from "@/app/api/v1/store/apps/[appId]/install/route";
import { startAppLifecycleAction } from "@/lib/server/modules/store/service";

describe("POST /api/v1/store/apps/:appId/install", () => {
  it("returns operation id", async () => {
    vi.mocked(startAppLifecycleAction).mockResolvedValueOnce({
      operationId: "op-install",
    });

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          env: {
            TZ: "UTC",
          },
          webUiPort: 3001,
        }),
      }),
      {
        params: Promise.resolve({
          appId: "adguard-home",
        }),
      },
    );

    const json = (await response.json()) as { operationId: string };

    expect(response.status).toBe(202);
    expect(json.operationId).toBe("op-install");
    expect(startAppLifecycleAction).toHaveBeenCalledWith({
      appId: "adguard-home",
      action: "install",
      displayName: undefined,
      env: {
        TZ: "UTC",
      },
      webUiPort: 3001,
    });
  });
});
