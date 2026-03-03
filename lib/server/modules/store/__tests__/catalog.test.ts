import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("store catalog", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("normalizes templates from upstream catalog", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          templates: [
            {
              name: "adguard-home",
              title: "AdGuard Home",
              description: "Network DNS blocker",
              note: "A note",
              categories: ["Network"],
              logo: "https://example.com/logo.png",
              repository: {
                url: "https://github.com/bigbeartechworld/big-bear-portainer",
                stackfile: "Apps/adguard-home/docker-compose.yml",
              },
              env: [
                {
                  name: "TZ",
                  default: "UTC",
                },
              ],
            },
          ],
        }),
        {
          status: 200,
          headers: {
            etag: "W/abc",
            "last-modified": "Mon, 01 Jan 2026 00:00:00 GMT",
          },
        },
      ),
    ) as typeof fetch;

    const { listStoreCatalogTemplates } = await import("@/lib/server/modules/store/catalog");
    const result = await listStoreCatalogTemplates({
      bypassCache: true,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      appId: "adguard-home",
      templateName: "adguard-home",
      name: "AdGuard Home",
      platform: "Docker",
      stackFile: "Apps/adguard-home/docker-compose.yml",
      repositoryUrl: "https://github.com/bigbeartechworld/big-bear-portainer",
    });
    expect(result[0].env).toEqual([
      {
        name: "TZ",
        default: "UTC",
      },
    ]);
  });

  it("removes BigBearCasaOS from categories", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          templates: [
            {
              name: "immich",
              title: "Immich",
              description: "Photos",
              categories: ["BigBearCasaOS", "Media", "Media"],
              repository: {
                url: "https://github.com/bigbeartechworld/big-bear-portainer",
                stackfile: "Apps/Immich/docker-compose.yml",
              },
            },
          ],
        }),
        { status: 200 },
      ),
    ) as typeof fetch;

    const { listStoreCatalogTemplates } = await import("@/lib/server/modules/store/catalog");
    const result = await listStoreCatalogTemplates({
      bypassCache: true,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.categories).toEqual(["Media"]);
  });

  it("falls back to cached catalog when fetch fails", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          templates: [
            {
              name: "homepage",
              title: "Homepage",
              description: "Dashboard",
              categories: ["Productivity"],
              repository: {
                url: "https://github.com/bigbeartechworld/big-bear-portainer",
                stackfile: "Apps/Homepage/docker-compose.yml",
              },
            },
          ],
        }),
        { status: 200 },
      ),
    ) as typeof fetch;
    global.fetch = fetchMock;

    const { listStoreCatalogTemplates } = await import("@/lib/server/modules/store/catalog");
    const first = await listStoreCatalogTemplates({
      bypassCache: true,
    });

    expect(first).toHaveLength(1);

    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const second = await listStoreCatalogTemplates({
      bypassCache: true,
    });

    expect(second).toEqual(first);
  });
});
