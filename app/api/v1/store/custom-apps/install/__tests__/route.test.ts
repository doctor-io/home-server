import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/server/modules/store/custom-apps", () => ({
  upsertCustomStoreTemplate: vi.fn(),
}))

vi.mock("@/lib/server/modules/store/service", () => ({
  startAppLifecycleAction: vi.fn(),
}))

import { POST } from "@/app/api/v1/store/custom-apps/install/route"
import {
  upsertCustomStoreTemplate,
} from "@/lib/server/modules/store/custom-apps"
import { startAppLifecycleAction } from "@/lib/server/modules/store/service"

describe("POST /api/v1/store/custom-apps/install", () => {
  it("creates custom template and starts install operation", async () => {
    vi.mocked(upsertCustomStoreTemplate).mockResolvedValueOnce({
      appId: "custom-homepage",
      templateName: "My Homepage",
      name: "My Homepage",
      description: "Custom app installed from docker compose",
      platform: "Docker Compose",
      note: "Custom app definition managed from App Store.",
      categories: ["Custom"],
      logoUrl: "https://example.com/logo.png",
      repositoryUrl: "custom://local",
      stackFile: "custom/custom-homepage/docker-compose.yml",
      env: [],
      isCustom: true,
      sourceType: "docker-compose",
      composeContent: "services:\n  app:\n    image: nginx",
      sourceText: "services:\n  app:\n    image: nginx",
      webUiUrl: "http://localhost:8088",
    })
    vi.mocked(startAppLifecycleAction).mockResolvedValueOnce({
      operationId: "op-custom-1",
    })

    const response = await POST(
      new Request("http://localhost/api/v1/store/custom-apps/install", {
        method: "POST",
        body: JSON.stringify({
          name: "My Homepage",
          iconUrl: "https://example.com/logo.png",
          webUiPort: 8088,
          sourceType: "docker-compose",
          source: "services:\n  app:\n    image: nginx",
        }),
      }),
    )

    const json = (await response.json()) as { appId: string; operationId: string }

    expect(response.status).toBe(202)
    expect(json).toEqual({
      appId: "custom-homepage",
      operationId: "op-custom-1",
    })
    expect(upsertCustomStoreTemplate).toHaveBeenCalledWith({
      name: "My Homepage",
      iconUrl: "https://example.com/logo.png",
      webUiUrl: "http://localhost:8088",
      sourceType: "docker-compose",
      sourceText: "services:\n  app:\n    image: nginx",
      repositoryUrl: undefined,
    })
    expect(startAppLifecycleAction).toHaveBeenCalledWith({
      appId: "custom-homepage",
      action: "install",
      displayName: "My Homepage",
      webUiPort: 8088,
    })
  })

  it("returns 400 when web ui port is invalid", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/store/custom-apps/install", {
        method: "POST",
        body: JSON.stringify({
          name: "Broken App",
          sourceType: "docker-run",
          source: "docker run nginx:latest",
          webUiPort: 99999,
        }),
      }),
    )

    expect(response.status).toBe(400)
    expect(upsertCustomStoreTemplate).not.toHaveBeenCalled()
    expect(startAppLifecycleAction).not.toHaveBeenCalled()
  })
})
