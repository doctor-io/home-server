import { describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

vi.mock("@/lib/server/modules/store/catalog", () => ({
  findStoreCatalogTemplateByAppId: vi.fn(),
}));

vi.mock("@/lib/server/modules/store/custom-apps", () => ({
  findCustomStoreTemplateByAppId: vi.fn(),
}));

vi.mock("@/lib/server/modules/apps/stacks-repository", () => ({
  findInstalledStackByAppId: vi.fn(),
}));

vi.mock("@/lib/server/modules/docker/compose-parser", () => ({
  parseComposeFile: vi.fn(),
  extractPrimaryServiceWithName: vi.fn(),
}));

vi.mock("@/lib/server/storage/data-root", () => ({
  resolveStoreStacksRoot: vi.fn(),
}));

import { readFile } from "node:fs/promises";
import { GET } from "@/app/api/v1/store/apps/[appId]/compose/route";
import { findInstalledStackByAppId } from "@/lib/server/modules/apps/stacks-repository";
import { findStoreCatalogTemplateByAppId } from "@/lib/server/modules/store/catalog";
import { findCustomStoreTemplateByAppId } from "@/lib/server/modules/store/custom-apps";
import {
  extractPrimaryServiceWithName,
  parseComposeFile,
} from "@/lib/server/modules/docker/compose-parser";
import { resolveStoreStacksRoot } from "@/lib/server/storage/data-root";

describe("GET /api/v1/store/apps/:appId/compose", () => {
  it("returns raw catalog compose with primary service metadata", async () => {
    const rawCompose = `services:\n  immich-server:\n    image: ghcr.io/immich-app/immich-server:v2.5.6\n  redis:\n    image: redis:6\n`;

    vi.mocked(findStoreCatalogTemplateByAppId).mockResolvedValue({
      appId: "immich",
      templateName: "immich",
      name: "Immich",
      description: "Photos",
      platform: "Docker Compose",
      note: "note",
      categories: ["Gallery"],
      logoUrl: null,
      repositoryUrl: "https://github.com/IceWhaleTech/CasaOS-AppStore",
      stackFile: "Apps/Immich/docker-compose.yml",
      composePath: "/tmp/CasaOS-AppStore/Apps/Immich/docker-compose.yml",
      env: [],
      screenshots: [],
      image: null,
      volumes: [],
      port: 2283,
      scheme: "http",
      index: "/",
      mainServiceName: "immich-server",
    });
    vi.mocked(readFile).mockResolvedValue(rawCompose);
    vi.mocked(parseComposeFile).mockReturnValue({
      services: {
        "immich-server": {
          image: "ghcr.io/immich-app/immich-server:v2.5.6",
        },
        redis: {
          image: "redis:6",
        },
      },
    });
    vi.mocked(extractPrimaryServiceWithName).mockReturnValue({
      name: "immich-server",
      service: {
        image: "ghcr.io/immich-app/immich-server:v2.5.6",
        ports: ["2283:2283"],
      },
    });

    const response = await GET(new Request("http://localhost/api/v1/store/apps/immich/compose?source=catalog"), {
      params: Promise.resolve({ appId: "immich" }),
    });

    const json = (await response.json()) as {
      data: {
        compose: string;
        primaryServiceName: string;
        primary: {
          image?: string;
        };
      };
    };

    expect(response.status).toBe(200);
    expect(json.data.compose).toBe(rawCompose);
    expect(json.data.primaryServiceName).toBe("immich-server");
    expect(json.data.primary.image).toBe("ghcr.io/immich-app/immich-server:v2.5.6");
  });

  it("returns 400 for invalid source", async () => {
    const response = await GET(new Request("http://localhost/api/v1/store/apps/immich/compose?source=bad"), {
      params: Promise.resolve({ appId: "immich" }),
    });

    expect(response.status).toBe(400);
    const json = (await response.json()) as { code: string };
    expect(json.code).toBe("invalid_source");
  });

  it("returns installed compose from disk", async () => {
    const rawCompose = `services:\n  home-assistant:\n    image: ghcr.io/home-assistant/home-assistant:latest\n`;

    vi.mocked(findInstalledStackByAppId).mockResolvedValue({
      appId: "home-assistant",
      templateName: "home-assistant",
      stackName: "home-assistant",
      composePath: "/DATA/Apps/home-assistant/docker-compose.yml",
      status: "installed",
      webUiPort: 8123,
      env: {},
      displayName: null,
      iconUrl: null,
      installedAt: "2026-02-26T00:00:00.000Z",
      updatedAt: "2026-02-26T00:00:00.000Z",
      isUpToDate: true,
      lastUpdateCheck: null,
      localDigest: null,
      remoteDigest: null,
    });
    vi.mocked(resolveStoreStacksRoot).mockReturnValue("/DATA/Apps");
    vi.mocked(readFile).mockResolvedValue(rawCompose);
    vi.mocked(parseComposeFile).mockReturnValue({
      services: {
        "home-assistant": {
          image: "ghcr.io/home-assistant/home-assistant:latest",
        },
      },
    });
    vi.mocked(extractPrimaryServiceWithName).mockReturnValue({
      name: "home-assistant",
      service: {
        image: "ghcr.io/home-assistant/home-assistant:latest",
      },
    });

    const response = await GET(new Request("http://localhost/api/v1/store/apps/home-assistant/compose?source=installed"), {
      params: Promise.resolve({ appId: "home-assistant" }),
    });

    const json = (await response.json()) as {
      data: {
        compose: string;
        primaryServiceName: string;
      };
    };

    expect(response.status).toBe(200);
    expect(json.data.compose).toBe(rawCompose);
    expect(json.data.primaryServiceName).toBe("home-assistant");
  });

  it("returns installed_compose_missing when installed stack is not found", async () => {
    vi.mocked(findInstalledStackByAppId).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/v1/store/apps/missing/compose?source=installed"), {
      params: Promise.resolve({ appId: "missing" }),
    });

    expect(response.status).toBe(404);
    const json = (await response.json()) as { code: string };
    expect(json.code).toBe("installed_compose_missing");
  });

  it("returns custom catalog compose from stored content", async () => {
    const rawCompose = `services:\n  app:\n    image: nginx:latest\n`;
    vi.mocked(findStoreCatalogTemplateByAppId).mockResolvedValue(null);
    vi.mocked(findCustomStoreTemplateByAppId).mockResolvedValue({
      appId: "custom-nginx",
      templateName: "custom-nginx",
      name: "Custom Nginx",
      description: "Custom app installed from docker compose",
      platform: "Docker Compose",
      note: "Custom app",
      categories: ["Custom"],
      logoUrl: null,
      repositoryUrl: "custom://local",
      stackFile: "custom/custom-nginx/docker-compose.yml",
      composePath: "/tmp/custom/custom-nginx/docker-compose.yml",
      env: [],
      screenshots: [],
      image: "nginx:latest",
      volumes: [],
      port: 8080,
      scheme: "http",
      index: "/",
      mainServiceName: "app",
      isCustom: true,
      sourceType: "docker-compose",
      composeContent: rawCompose,
      sourceText: rawCompose,
    });
    vi.mocked(parseComposeFile).mockReturnValue({
      services: {
        app: {
          image: "nginx:latest",
        },
      },
    });
    vi.mocked(extractPrimaryServiceWithName).mockReturnValue({
      name: "app",
      service: {
        image: "nginx:latest",
      },
    });

    const response = await GET(new Request("http://localhost/api/v1/store/apps/custom-nginx/compose?source=catalog"), {
      params: Promise.resolve({ appId: "custom-nginx" }),
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { data: { compose: string } };
    expect(json.data.compose).toBe(rawCompose);
  });
});
