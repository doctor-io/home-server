import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/store/service", () => ({
  listStoreApps: vi.fn(),
}));

import { GET } from "@/app/api/v1/store/apps/route";
import { listStoreApps } from "@/lib/server/modules/store/service";

describe("GET /api/v1/store/apps", () => {
  it("returns filtered store apps", async () => {
    vi.mocked(listStoreApps).mockResolvedValueOnce([
      {
        id: "adguard-home",
        name: "AdGuard Home",
        description: "dns",
        platform: "Docker",
        categories: ["Network"],
        logoUrl: null,
        repositoryUrl: "https://github.com/bigbeartechworld/big-bear-portainer",
        stackFile: "Apps/adguard-home/docker-compose.yml",
        status: "installed",
        webUiPort: 3001,
        updateAvailable: false,
        localDigest: null,
        remoteDigest: null,
      },
    ]);

    const request = new NextRequest(
      "http://localhost/api/v1/store/apps?category=Network&installedOnly=true",
    );
    const response = await GET(request);
    const json = (await response.json()) as {
      data: unknown[];
      meta: { count: number };
    };

    expect(response.status).toBe(200);
    expect(json.meta.count).toBe(1);
    expect(vi.mocked(listStoreApps)).toHaveBeenCalledWith({
      category: "Network",
      search: undefined,
      installedOnly: true,
      updatesOnly: false,
    });
  });

  it("returns 500 when service fails", async () => {
    vi.mocked(listStoreApps).mockRejectedValueOnce(new Error("boom"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(new NextRequest("http://localhost/api/v1/store/apps"));
    const json = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(json.error).toBe("Unable to load store apps");
    expect(consoleSpy).toHaveBeenCalled();
  });
});
