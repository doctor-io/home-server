import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/store/service", () => ({
  startAppLifecycleAction: vi.fn(),
}));

import { POST } from "@/app/api/v1/store/apps/[appId]/uninstall/route";
import { startAppLifecycleAction } from "@/lib/server/modules/store/service";

describe("POST /api/v1/store/apps/:appId/uninstall", () => {
  it("starts an uninstall operation", async () => {
    vi.mocked(startAppLifecycleAction).mockResolvedValueOnce({
      operationId: "op-uninstall",
    });

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          removeVolumes: true,
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
    expect(json.operationId).toBe("op-uninstall");
    expect(startAppLifecycleAction).toHaveBeenCalledWith({
      appId: "homepage",
      action: "uninstall",
      removeVolumes: true,
    });
  });
});
