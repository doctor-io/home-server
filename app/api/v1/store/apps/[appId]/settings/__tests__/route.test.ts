import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/store/service", () => ({
  saveAppSettings: vi.fn(),
}));

import { PATCH } from "@/app/api/v1/store/apps/[appId]/settings/route";
import { saveAppSettings } from "@/lib/server/modules/store/service";

describe("PATCH /api/v1/store/apps/:appId/settings", () => {
  it("saves metadata-only changes without redeploy", async () => {
    vi.mocked(saveAppSettings).mockResolvedValueOnce({});

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          displayName: "My Custom App",
          iconUrl: "https://example.com/icon.png",
        }),
      }),
      {
        params: Promise.resolve({
          appId: "home-assistant",
        }),
      },
    );

    const json = (await response.json()) as {
      saved: boolean;
      operationId?: string;
    };

    expect(response.status).toBe(200);
    expect(json.saved).toBe(true);
    expect(json.operationId).toBeUndefined();
    expect(saveAppSettings).toHaveBeenCalledWith({
      appId: "home-assistant",
      displayName: "My Custom App",
      iconUrl: "https://example.com/icon.png",
    });
  });

  it("saves config changes and triggers redeploy", async () => {
    vi.mocked(saveAppSettings).mockResolvedValueOnce({
      operationId: "op-redeploy-123",
    });

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          env: {
            TZ: "America/New_York",
          },
          webUiPort: 8124,
        }),
      }),
      {
        params: Promise.resolve({
          appId: "home-assistant",
        }),
      },
    );

    const json = (await response.json()) as {
      saved: boolean;
      operationId?: string;
    };

    expect(response.status).toBe(200);
    expect(json.saved).toBe(true);
    expect(json.operationId).toBe("op-redeploy-123");
    expect(saveAppSettings).toHaveBeenCalledWith({
      appId: "home-assistant",
      env: {
        TZ: "America/New_York",
      },
      webUiPort: 8124,
    });
  });

  it("saves combined metadata and config changes", async () => {
    vi.mocked(saveAppSettings).mockResolvedValueOnce({
      operationId: "op-redeploy-456",
    });

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          displayName: "My Home Assistant",
          iconUrl: null,
          env: {
            TZ: "Europe/London",
          },
          webUiPort: 9000,
        }),
      }),
      {
        params: Promise.resolve({
          appId: "home-assistant",
        }),
      },
    );

    const json = (await response.json()) as {
      saved: boolean;
      operationId?: string;
    };

    expect(response.status).toBe(200);
    expect(json.saved).toBe(true);
    expect(json.operationId).toBe("op-redeploy-456");
    expect(saveAppSettings).toHaveBeenCalledWith({
      appId: "home-assistant",
      displayName: "My Home Assistant",
      iconUrl: null,
      env: {
        TZ: "Europe/London",
      },
      webUiPort: 9000,
    });
  });

  it("returns 400 for invalid payload", async () => {
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          displayName: "", // too short
          webUiPort: 99999, // too large
        }),
      }),
      {
        params: Promise.resolve({
          appId: "home-assistant",
        }),
      },
    );

    expect(response.status).toBe(400);
    const json = (await response.json()) as {
      error: string;
      issues: unknown;
    };
    expect(json.error).toBe("Invalid settings payload");
    expect(json.issues).toBeDefined();
  });

  it("returns 500 when service throws error", async () => {
    vi.mocked(saveAppSettings).mockRejectedValueOnce(
      new Error("Database connection failed"),
    );

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          displayName: "Test App",
        }),
      }),
      {
        params: Promise.resolve({
          appId: "home-assistant",
        }),
      },
    );

    expect(response.status).toBe(500);
    const json = (await response.json()) as { error: string };
    expect(json.error).toBe("Failed to save app settings");
  });
});
