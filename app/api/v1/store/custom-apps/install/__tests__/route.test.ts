import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/store/custom-apps", () => ({
  upsertCustomStoreTemplate: vi.fn(),
}));

vi.mock("@/lib/server/modules/store/service", () => ({
  startAppLifecycleAction: vi.fn(),
}));

import { POST } from "@/app/api/v1/store/custom-apps/install/route";
import {
  upsertCustomStoreTemplate,
} from "@/lib/server/modules/store/custom-apps";
import { startAppLifecycleAction } from "@/lib/server/modules/store/service";

describe("POST /api/v1/store/custom-apps/install", () => {
  it("creates custom template and starts install operation", async () => {
    vi.mocked(upsertCustomStoreTemplate).mockResolvedValueOnce({
      appId: "custom-homepage",
      templateName: "custom-homepage",
      name: "My Homepage",
      description: "Custom app installed from docker compose",
      platform: "Docker Compose",
      note: "Custom app definition managed from App Store.",
      categories: ["Custom"],
      logoUrl: "https://example.com/logo.png",
      repositoryUrl: "custom://local",
      stackFile: "custom/custom-homepage/docker-compose.yml",
      composePath: "/tmp/custom/custom-homepage/docker-compose.yml",
      env: [],
      screenshots: [],
      image: "nginx:latest",
      volumes: [],
      port: 8088,
      scheme: "http",
      index: "/",
      mainServiceName: "app",
      isCustom: true,
      sourceType: "docker-compose",
      composeContent: "services:\n  app:\n    image: nginx:latest",
      sourceText: "services:\n  app:\n    image: nginx:latest",
    });
    vi.mocked(startAppLifecycleAction).mockResolvedValueOnce({
      operationId: "11111111-1111-1111-1111-111111111111",
    });

    const response = await POST(
      new Request("http://localhost/api/v1/store/custom-apps/install", {
        method: "POST",
        body: JSON.stringify({
          name: "My Homepage",
          iconUrl: "https://example.com/logo.png",
          sourceType: "docker-compose",
          source: "services:\n  app:\n    image: nginx:latest",
        }),
      }),
    );

    const json = (await response.json()) as { appId: string; operationId: string };

    expect(response.status).toBe(202);
    expect(json).toEqual({
      appId: "custom-homepage",
      operationId: "11111111-1111-1111-1111-111111111111",
    });
    expect(upsertCustomStoreTemplate).toHaveBeenCalledWith({
      name: "My Homepage",
      iconUrl: "https://example.com/logo.png",
      sourceType: "docker-compose",
      sourceText: "services:\n  app:\n    image: nginx:latest",
      repositoryUrl: undefined,
    });
    expect(startAppLifecycleAction).toHaveBeenCalledWith({
      appId: "custom-homepage",
      action: "install",
      displayName: "My Homepage",
    });
  });

  it("returns 400 when payload is invalid", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/store/custom-apps/install", {
        method: "POST",
        body: JSON.stringify({
          name: "Broken App",
          sourceType: "docker-run",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(upsertCustomStoreTemplate).not.toHaveBeenCalled();
    expect(startAppLifecycleAction).not.toHaveBeenCalled();
  });
});
