import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/store/service", () => ({
  getStoreAppDetail: vi.fn(),
}));

import { GET } from "@/app/api/v1/store/apps/[appId]/route";
import { getStoreAppDetail } from "@/lib/server/modules/store/service";

describe("GET /api/v1/store/apps/:appId", () => {
  it("returns app detail when found", async () => {
    vi.mocked(getStoreAppDetail).mockResolvedValueOnce({
      id: "homepage",
      name: "Homepage",
      description: "dashboard",
      platform: "Docker",
      categories: ["Productivity"],
      logoUrl: null,
      repositoryUrl: "https://github.com/bigbeartechworld/big-bear-portainer",
      stackFile: "Apps/Homepage/docker-compose.yml",
      status: "not_installed",
      webUiPort: null,
      updateAvailable: false,
      localDigest: null,
      remoteDigest: null,
      note: "note",
      env: [],
      installedConfig: null,
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({
        appId: "homepage",
      }),
    });
    const json = (await response.json()) as { data: { id: string } };

    expect(response.status).toBe(200);
    expect(json.data.id).toBe("homepage");
  });

  it("returns 404 when app does not exist", async () => {
    vi.mocked(getStoreAppDetail).mockResolvedValueOnce(null);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({
        appId: "missing",
      }),
    });

    expect(response.status).toBe(404);
  });
});
