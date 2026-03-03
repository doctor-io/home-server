import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import yaml from "js-yaml";

vi.mock("@/lib/server/modules/store/catalog", () => ({
  findStoreCatalogTemplateByAppId: vi.fn(),
}));

vi.mock("@/lib/server/modules/docker/compose-parser", () => ({
  parseComposeFile: vi.fn(),
  extractPrimaryServiceWithName: vi.fn(),
  fetchComposeFileFromGitHub: vi.fn(),
}));

vi.mock("@/lib/server/modules/docker/compose-runner", () => ({
  cleanupComposeDataOnUninstall: vi.fn(),
  extractComposeImages: vi.fn(),
  materializeInlineStackFiles: vi.fn(),
  materializeStackFiles: vi.fn(),
  runComposeDown: vi.fn(),
  runComposeUp: vi.fn(),
  sanitizeStackName: vi.fn(() => "adguard-home"),
}));

vi.mock("@/lib/server/modules/store/custom-apps", () => ({
  findCustomStoreTemplateByAppId: vi.fn(),
  isCustomStoreTemplate: vi.fn(() => false),
}));

vi.mock("@/lib/server/modules/store/docker-client", () => ({
  pullDockerImage: vi.fn(),
}));

vi.mock("@/lib/server/modules/apps/service", () => ({
  invalidateInstalledAppsCache: vi.fn(),
}));

vi.mock("@/lib/server/modules/apps/stacks-repository", () => ({
  createStoreOperation: vi.fn(),
  deleteInstalledStackByAppId: vi.fn(),
  findInstalledStackByAppId: vi.fn(),
  findStackByWebUiPort: vi.fn(),
  findStoreOperationById: vi.fn(),
  updateStoreOperation: vi.fn(),
  updateStackUpdateStatus: vi.fn(),
  upsertInstalledStack: vi.fn(),
}));

import { findStoreCatalogTemplateByAppId } from "@/lib/server/modules/store/catalog";
import {
  extractPrimaryServiceWithName,
  fetchComposeFileFromGitHub,
  parseComposeFile,
} from "@/lib/server/modules/docker/compose-parser";
import {
  cleanupComposeDataOnUninstall,
  extractComposeImages,
  materializeInlineStackFiles,
  materializeStackFiles,
  runComposeDown,
  runComposeUp,
} from "@/lib/server/modules/docker/compose-runner";
import { findCustomStoreTemplateByAppId } from "@/lib/server/modules/store/custom-apps";
import { pullDockerImage } from "@/lib/server/modules/store/docker-client";
import { invalidateInstalledAppsCache } from "@/lib/server/modules/apps/service";
import {
  createStoreOperation,
  deleteInstalledStackByAppId,
  findInstalledStackByAppId,
  findStackByWebUiPort,
  updateStoreOperation,
  updateStackUpdateStatus,
  upsertInstalledStack,
} from "@/lib/server/modules/apps/stacks-repository";
import {
  getLatestStoreOperationEvent,
  startStoreOperation,
} from "@/lib/server/modules/apps/operations";

async function waitForLatestEventType(operationId: string, expectedType: string) {
  for (let index = 0; index < 50; index += 1) {
    const latest = getLatestStoreOperationEvent(operationId);
    if (latest?.type === expectedType) {
      return latest;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }

  throw new Error(`Timed out waiting for event type "${expectedType}"`);
}

describe("store operations", () => {
  beforeEach(() => {
    vi.mocked(findStoreCatalogTemplateByAppId).mockReset();
    vi.mocked(findCustomStoreTemplateByAppId).mockReset();
    vi.mocked(cleanupComposeDataOnUninstall).mockReset();
    vi.mocked(parseComposeFile).mockReset();
    vi.mocked(extractPrimaryServiceWithName).mockReset();
    vi.mocked(fetchComposeFileFromGitHub).mockReset();
    vi.mocked(materializeInlineStackFiles).mockReset();
    vi.mocked(materializeStackFiles).mockReset();
    vi.mocked(extractComposeImages).mockReset();
    vi.mocked(pullDockerImage).mockReset();
    vi.mocked(runComposeUp).mockReset();
    vi.mocked(invalidateInstalledAppsCache).mockReset();
    vi.mocked(createStoreOperation).mockReset();
    vi.mocked(deleteInstalledStackByAppId).mockReset();
    vi.mocked(findInstalledStackByAppId).mockReset();
    vi.mocked(findStackByWebUiPort).mockReset();
    vi.mocked(updateStoreOperation).mockReset();
    vi.mocked(updateStackUpdateStatus).mockReset();
    vi.mocked(upsertInstalledStack).mockReset();
  });

  it("runs install flow and completes with progress updates", async () => {
    vi.mocked(findStoreCatalogTemplateByAppId).mockResolvedValue({
      appId: "adguard-home",
      templateName: "adguard-home",
      name: "AdGuard Home",
      description: "dns",
      platform: "Docker",
      note: "note",
      categories: ["Network"],
      logoUrl: null,
      port: null,
      repositoryUrl: "https://github.com/bigbeartechworld/big-bear-portainer",
      stackFile: "Apps/adguard-home/docker-compose.yml",
      env: [{ name: "TZ", default: "UTC" }],
    });
    vi.mocked(findCustomStoreTemplateByAppId).mockResolvedValue(null);

    vi.mocked(findInstalledStackByAppId).mockResolvedValue(null);
    vi.mocked(findStackByWebUiPort).mockResolvedValue(null);
    vi.mocked(materializeStackFiles).mockResolvedValue({
      stackDir: "/tmp/store/stacks/adguard-home",
      composePath: "/tmp/store/stacks/adguard-home/docker-compose.yml",
      envPath: "/tmp/store/stacks/adguard-home/.env",
      stackName: "adguard-home",
      webUiPort: 3001,
    });
    vi.mocked(extractComposeImages).mockResolvedValue(["ghcr.io/example/app:latest"]);
    vi.mocked(pullDockerImage).mockImplementation(async (_image, onEvent) => {
      if (!onEvent) return;
      await onEvent({
        status: "Downloading",
        progressDetail: {
          current: 25,
          total: 100,
          percent: 25,
        },
      });
      await onEvent({
        status: "Download complete",
        progressDetail: {
          current: 100,
          total: 100,
          percent: 100,
        },
      });
    });

    vi.mocked(createStoreOperation).mockResolvedValue(undefined);
    vi.mocked(updateStoreOperation).mockResolvedValue(undefined);
    vi.mocked(updateStackUpdateStatus).mockResolvedValue(undefined);
    vi.mocked(runComposeUp).mockResolvedValue(undefined);
    vi.mocked(upsertInstalledStack).mockResolvedValue(undefined);

    let finished = false;
    const done = new Promise<void>((resolve) => {
      vi.mocked(updateStoreOperation).mockImplementation(async (_id, patch) => {
        if (!finished && patch.status === "success") {
          finished = true;
          resolve();
        }
      });
    });

    const { operationId } = await startStoreOperation({
      appId: "adguard-home",
      action: "install",
      webUiPort: 3001,
      env: {
        TZ: "Africa/Tunis",
      },
    });

    await done;

    expect(operationId).toBeTruthy();
    expect(upsertInstalledStack).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: "adguard-home",
        status: "installed",
        webUiPort: 3001,
      }),
    );
    expect(materializeStackFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: "adguard-home",
        storageMappingStrategy: "app_target_path",
      }),
    );
    expect(invalidateInstalledAppsCache).toHaveBeenCalledTimes(1);
    expect(runComposeUp).toHaveBeenCalled();

    const latest = await waitForLatestEventType(operationId, "operation.completed");
    expect(latest?.status).toBe("success");
  });

  it("marks operation as failed when docker pull fails", async () => {
    vi.mocked(findStoreCatalogTemplateByAppId).mockResolvedValue({
      appId: "homepage",
      templateName: "homepage",
      name: "Homepage",
      description: "dashboard",
      platform: "Docker",
      note: "note",
      categories: ["Productivity"],
      logoUrl: null,
      port: null,
      repositoryUrl: "https://github.com/bigbeartechworld/big-bear-portainer",
      stackFile: "Apps/Homepage/docker-compose.yml",
      env: [],
    });
    vi.mocked(findCustomStoreTemplateByAppId).mockResolvedValue(null);

    vi.mocked(findInstalledStackByAppId).mockResolvedValue(null);
    vi.mocked(findStackByWebUiPort).mockResolvedValue(null);
    vi.mocked(materializeStackFiles).mockResolvedValue({
      stackDir: "/tmp/store/stacks/homepage",
      composePath: "/tmp/store/stacks/homepage/docker-compose.yml",
      envPath: "/tmp/store/stacks/homepage/.env",
      stackName: "homepage",
      webUiPort: null,
    });
    vi.mocked(extractComposeImages).mockResolvedValue(["ghcr.io/example/homepage:latest"]);
    vi.mocked(pullDockerImage).mockRejectedValue(new Error("unauthorized"));
    vi.mocked(createStoreOperation).mockResolvedValue(undefined);
    vi.mocked(updateStoreOperation).mockResolvedValue(undefined);
    vi.mocked(updateStackUpdateStatus).mockResolvedValue(undefined);

    let failed = false;
    const done = new Promise<void>((resolve) => {
      vi.mocked(updateStoreOperation).mockImplementation(async (_id, patch) => {
        if (!failed && patch.status === "error") {
          failed = true;
          resolve();
        }
      });
    });

    const { operationId } = await startStoreOperation({
      appId: "homepage",
      action: "install",
    });

    await done;

    const latest = await waitForLatestEventType(operationId, "operation.failed");
    expect(latest?.status).toBe("error");
  });

  it("hard-deletes stack record on uninstall and removes data when requested", async () => {
    vi.mocked(findInstalledStackByAppId).mockResolvedValue({
      appId: "2fauth",
      templateName: "2fauth",
      stackName: "big-bear-2fauth",
      composePath: "/tmp/store/stacks/2fauth/docker-compose.yml",
      status: "installed",
      webUiPort: 8000,
      env: {},
      installedAt: "2026-02-24T00:00:00.000Z",
      updatedAt: "2026-02-24T00:00:00.000Z",
    });

    vi.mocked(createStoreOperation).mockResolvedValue(undefined);
    vi.mocked(updateStoreOperation).mockResolvedValue(undefined);
    vi.mocked(runComposeDown).mockResolvedValue(undefined);
    vi.mocked(cleanupComposeDataOnUninstall).mockResolvedValue(undefined);
    vi.mocked(deleteInstalledStackByAppId).mockResolvedValue(undefined);

    let finished = false;
    const done = new Promise<void>((resolve) => {
      vi.mocked(updateStoreOperation).mockImplementation(async (_id, patch) => {
        if (!finished && patch.status === "success") {
          finished = true;
          resolve();
        }
      });
    });

    const { operationId } = await startStoreOperation({
      appId: "2fauth",
      action: "uninstall",
      removeVolumes: true,
    });

    await done;

    expect(runComposeDown).toHaveBeenCalledWith({
      composePath: "/tmp/store/stacks/2fauth/docker-compose.yml",
      envPath: "/tmp/store/stacks/2fauth/.env",
      stackName: "big-bear-2fauth",
      removeVolumes: true,
    });
    expect(cleanupComposeDataOnUninstall).toHaveBeenCalledWith({
      composePath: "/tmp/store/stacks/2fauth/docker-compose.yml",
    });
    expect(deleteInstalledStackByAppId).toHaveBeenCalledWith("2fauth");
    expect(invalidateInstalledAppsCache).toHaveBeenCalledTimes(1);

    const latest = await waitForLatestEventType(operationId, "operation.completed");
    expect(latest?.status).toBe("success");
  });

  it("uses legacy storage mapping on redeploy for existing apps", async () => {
    vi.mocked(findStoreCatalogTemplateByAppId).mockResolvedValue({
      appId: "home-assistant",
      templateName: "home-assistant",
      name: "Home Assistant",
      description: "automation",
      platform: "Docker",
      note: "note",
      categories: ["Automation"],
      logoUrl: null,
      port: null,
      repositoryUrl: "https://github.com/bigbeartechworld/big-bear-portainer",
      stackFile: "Apps/home-assistant/docker-compose.yml",
      env: [],
    });
    vi.mocked(findCustomStoreTemplateByAppId).mockResolvedValue(null);
    vi.mocked(findInstalledStackByAppId).mockResolvedValue({
      appId: "home-assistant",
      templateName: "home-assistant",
      stackName: "home-assistant",
      composePath: "/tmp/store/stacks/home-assistant/docker-compose.yml",
      status: "installed",
      webUiPort: null,
      env: {},
      installedAt: "2026-02-24T00:00:00.000Z",
      updatedAt: "2026-02-24T00:00:00.000Z",
    });
    vi.mocked(findStackByWebUiPort).mockResolvedValue(null);
    vi.mocked(materializeStackFiles).mockResolvedValue({
      stackDir: "/tmp/store/stacks/home-assistant",
      composePath: "/tmp/store/stacks/home-assistant/docker-compose.yml",
      envPath: "/tmp/store/stacks/home-assistant/.env",
      stackName: "home-assistant",
      webUiPort: null,
    });
    vi.mocked(extractComposeImages).mockResolvedValue([]);
    vi.mocked(createStoreOperation).mockResolvedValue(undefined);
    vi.mocked(updateStoreOperation).mockResolvedValue(undefined);
    vi.mocked(updateStackUpdateStatus).mockResolvedValue(undefined);
    vi.mocked(runComposeUp).mockResolvedValue(undefined);
    vi.mocked(upsertInstalledStack).mockResolvedValue(undefined);

    let finished = false;
    const done = new Promise<void>((resolve) => {
      vi.mocked(updateStoreOperation).mockImplementation(async (_id, patch) => {
        if (!finished && patch.status === "success") {
          finished = true;
          resolve();
        }
      });
    });

    await startStoreOperation({
      appId: "home-assistant",
      action: "redeploy",
    });

    await done;

    expect(materializeStackFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: "home-assistant",
        storageMappingStrategy: "legacy_named_source",
      }),
    );
    expect(invalidateInstalledAppsCache).toHaveBeenCalledTimes(1);
  });

  it("uses composeSource for install materialization and bypasses template env whitelist", async () => {
    const composeSource = `services:\n  immich-server:\n    image: ghcr.io/immich-app/immich-server:v2.5.6\n    ports:\n      - \"2283:2283\"\n    environment:\n      DB_HOSTNAME: immich-postgres\n      CUSTOM_ENV: yes\n`;

    vi.mocked(findStoreCatalogTemplateByAppId).mockResolvedValue({
      appId: "immich",
      templateName: "immich",
      name: "Immich",
      description: "photos",
      platform: "Docker",
      note: "note",
      categories: ["Photos"],
      logoUrl: null,
      port: null,
      repositoryUrl: "https://github.com/bigbeartechworld/big-bear-portainer",
      stackFile: "Apps/immich/docker-compose.yml",
      env: [{ name: "TZ", default: "UTC" }],
    });
    vi.mocked(findCustomStoreTemplateByAppId).mockResolvedValue(null);
    vi.mocked(findInstalledStackByAppId).mockResolvedValue(null);
    vi.mocked(findStackByWebUiPort).mockResolvedValue(null);
    vi.mocked(parseComposeFile).mockReturnValue({
      services: {
        "immich-server": {
          image: "ghcr.io/immich-app/immich-server:v2.5.6",
          ports: ["2283:2283"],
          environment: {
            DB_HOSTNAME: "immich-postgres",
            CUSTOM_ENV: "yes",
          },
        },
      },
    });
    vi.mocked(extractPrimaryServiceWithName).mockReturnValue({
      name: "immich-server",
      service: {
        image: "ghcr.io/immich-app/immich-server:v2.5.6",
        ports: ["2283:2283"],
        environment: {
          DB_HOSTNAME: "immich-postgres",
          CUSTOM_ENV: "yes",
        },
      },
    });
    vi.mocked(materializeInlineStackFiles).mockResolvedValue({
      stackDir: "/tmp/store/stacks/immich",
      composePath: "/tmp/store/stacks/immich/docker-compose.yml",
      envPath: "/tmp/store/stacks/immich/.env",
      stackName: "immich",
      webUiPort: 2283,
    });
    vi.mocked(extractComposeImages).mockResolvedValue([]);
    vi.mocked(createStoreOperation).mockResolvedValue(undefined);
    vi.mocked(updateStoreOperation).mockResolvedValue(undefined);
    vi.mocked(updateStackUpdateStatus).mockResolvedValue(undefined);
    vi.mocked(runComposeUp).mockResolvedValue(undefined);
    vi.mocked(upsertInstalledStack).mockResolvedValue(undefined);

    let finished = false;
    const done = new Promise<void>((resolve) => {
      vi.mocked(updateStoreOperation).mockImplementation(async (_id, patch) => {
        if (!finished && patch.status === "success") {
          finished = true;
          resolve();
        }
      });
    });

    await startStoreOperation({
      appId: "immich",
      action: "install",
      composeSource,
    });

    await done;

    expect(materializeInlineStackFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: "immich",
        composeContent: composeSource,
      }),
    );
    expect(materializeStackFiles).not.toHaveBeenCalled();
    expect(upsertInstalledStack).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: "immich",
        env: expect.objectContaining({
          DB_HOSTNAME: "immich-postgres",
          CUSTOM_ENV: "yes",
        }),
      }),
    );
  });

  it("updates only service images and preserves other compose fields", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "store-update-"));
    const composePath = path.join(tempDir, "docker-compose.yml");
    const initialCompose = `services:
  app:
    image: ghcr.io/example/app:v1
    environment:
      TZ: UTC
      APP_URL: http://localhost:3100
    ports:
      - "3100:3100"
  redis:
    image: redis:6
`;
    await writeFile(composePath, initialCompose, "utf8");

    vi.mocked(findStoreCatalogTemplateByAppId).mockResolvedValue({
      appId: "example",
      templateName: "example",
      name: "Example",
      description: "example",
      platform: "Docker",
      note: "note",
      categories: ["Tools"],
      logoUrl: null,
      port: null,
      repositoryUrl: "https://github.com/example/store",
      stackFile: "Apps/example/docker-compose.yml",
      env: [],
    });
    vi.mocked(findCustomStoreTemplateByAppId).mockResolvedValue(null);
    vi.mocked(fetchComposeFileFromGitHub).mockResolvedValue(`services:
  app:
    image: ghcr.io/example/app:v2
  redis:
    image: redis:7
`);
    vi.mocked(findInstalledStackByAppId).mockResolvedValue({
      appId: "example",
      templateName: "example",
      stackName: "example",
      composePath,
      status: "installed",
      webUiPort: 3100,
      env: {
        TZ: "UTC",
      },
      installedAt: "2026-02-24T00:00:00.000Z",
      updatedAt: "2026-02-24T00:00:00.000Z",
    });
    vi.mocked(extractComposeImages).mockResolvedValue([]);
    vi.mocked(runComposeUp).mockResolvedValue(undefined);
    vi.mocked(createStoreOperation).mockResolvedValue(undefined);
    vi.mocked(updateStoreOperation).mockResolvedValue(undefined);
    vi.mocked(updateStackUpdateStatus).mockResolvedValue(undefined);
    vi.mocked(upsertInstalledStack).mockResolvedValue(undefined);

    let finished = false;
    const done = new Promise<void>((resolve) => {
      vi.mocked(updateStoreOperation).mockImplementation(async (_id, patch) => {
        if (!finished && patch.status === "success") {
          finished = true;
          resolve();
        }
      });
    });

    await startStoreOperation({
      appId: "example",
      action: "update",
    });

    await done;

    const updatedCompose = await readFile(composePath, "utf8");
    const parsed = yaml.load(updatedCompose) as {
      services: Record<string, { image?: string; environment?: Record<string, string>; ports?: string[] }>;
    };

    expect(parsed.services.app.image).toBe("ghcr.io/example/app:v2");
    expect(parsed.services.redis.image).toBe("redis:7");
    expect(parsed.services.app.environment).toEqual({
      TZ: "UTC",
      APP_URL: "http://localhost:3100",
    });
    expect(parsed.services.app.ports).toEqual(["3100:3100"]);
    expect(runComposeUp).toHaveBeenCalledTimes(1);

    await rm(tempDir, { recursive: true, force: true });
  });

  it("treats update as no-op when installed images are already current", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "store-update-noop-"));
    const composePath = path.join(tempDir, "docker-compose.yml");
    const initialCompose = `services:\n  app:\n    image: ghcr.io/example/app:v2\n    environment:\n      TZ: UTC\n`;
    await writeFile(composePath, initialCompose, "utf8");

    vi.mocked(findStoreCatalogTemplateByAppId).mockResolvedValue({
      appId: "example",
      templateName: "example",
      name: "Example",
      description: "example",
      platform: "Docker",
      note: "note",
      categories: ["Tools"],
      logoUrl: null,
      port: null,
      repositoryUrl: "https://github.com/example/store",
      stackFile: "Apps/example/docker-compose.yml",
      env: [],
    });
    vi.mocked(findCustomStoreTemplateByAppId).mockResolvedValue(null);
    vi.mocked(fetchComposeFileFromGitHub).mockResolvedValue(`services:\n  app:\n    image: ghcr.io/example/app:v2\n`);
    vi.mocked(findInstalledStackByAppId).mockResolvedValue({
      appId: "example",
      templateName: "example",
      stackName: "example",
      composePath,
      status: "installed",
      webUiPort: 3100,
      env: {
        TZ: "UTC",
      },
      installedAt: "2026-02-24T00:00:00.000Z",
      updatedAt: "2026-02-24T00:00:00.000Z",
    });
    vi.mocked(createStoreOperation).mockResolvedValue(undefined);
    vi.mocked(updateStoreOperation).mockResolvedValue(undefined);
    vi.mocked(updateStackUpdateStatus).mockResolvedValue(undefined);

    let finished = false;
    const done = new Promise<void>((resolve) => {
      vi.mocked(updateStoreOperation).mockImplementation(async (_id, patch) => {
        if (!finished && patch.status === "success") {
          finished = true;
          resolve();
        }
      });
    });

    const { operationId } = await startStoreOperation({
      appId: "example",
      action: "update",
    });

    await done;

    const latest = await waitForLatestEventType(operationId, "operation.completed");
    expect(latest?.status).toBe("success");
    expect(runComposeUp).not.toHaveBeenCalled();
    expect(extractComposeImages).not.toHaveBeenCalled();

    const composeAfterNoop = await readFile(composePath, "utf8");
    expect(composeAfterNoop).toBe(initialCompose);

    await rm(tempDir, { recursive: true, force: true });
  });

  it("fails update with explicit error when installed compose is missing", async () => {
    vi.mocked(findStoreCatalogTemplateByAppId).mockResolvedValue({
      appId: "example",
      templateName: "example",
      name: "Example",
      description: "example",
      platform: "Docker",
      note: "note",
      categories: ["Tools"],
      logoUrl: null,
      port: null,
      repositoryUrl: "https://github.com/example/store",
      stackFile: "Apps/example/docker-compose.yml",
      env: [],
    });
    vi.mocked(findCustomStoreTemplateByAppId).mockResolvedValue(null);
    vi.mocked(findInstalledStackByAppId).mockResolvedValue({
      appId: "example",
      templateName: "example",
      stackName: "example",
      composePath: "/tmp/missing-compose/docker-compose.yml",
      status: "installed",
      webUiPort: 3100,
      env: {},
      installedAt: "2026-02-24T00:00:00.000Z",
      updatedAt: "2026-02-24T00:00:00.000Z",
    });
    vi.mocked(createStoreOperation).mockResolvedValue(undefined);
    vi.mocked(updateStoreOperation).mockResolvedValue(undefined);
    vi.mocked(updateStackUpdateStatus).mockResolvedValue(undefined);

    let failed = false;
    const done = new Promise<void>((resolve) => {
      vi.mocked(updateStoreOperation).mockImplementation(async (_id, patch) => {
        if (!failed && patch.status === "error") {
          failed = true;
          resolve();
        }
      });
    });

    const { operationId } = await startStoreOperation({
      appId: "example",
      action: "update",
    });

    await done;

    const latest = await waitForLatestEventType(operationId, "operation.failed");
    expect(latest?.message).toBe("Installed compose source is unavailable");
    expect(fetchComposeFileFromGitHub).not.toHaveBeenCalled();
    expect(runComposeUp).not.toHaveBeenCalled();
  });

  it("fails update when installed and store services do not match", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "store-update-mismatch-"));
    const composePath = path.join(tempDir, "docker-compose.yml");
    const initialCompose = `services:\n  app:\n    image: ghcr.io/example/app:v1\n`;
    await writeFile(composePath, initialCompose, "utf8");

    vi.mocked(findStoreCatalogTemplateByAppId).mockResolvedValue({
      appId: "example",
      templateName: "example",
      name: "Example",
      description: "example",
      platform: "Docker",
      note: "note",
      categories: ["Tools"],
      logoUrl: null,
      port: null,
      repositoryUrl: "https://github.com/example/store",
      stackFile: "Apps/example/docker-compose.yml",
      env: [],
    });
    vi.mocked(findCustomStoreTemplateByAppId).mockResolvedValue(null);
    vi.mocked(fetchComposeFileFromGitHub).mockResolvedValue(`services:
  web:
    image: ghcr.io/example/app:v2
`);
    vi.mocked(findInstalledStackByAppId).mockResolvedValue({
      appId: "example",
      templateName: "example",
      stackName: "example",
      composePath,
      status: "installed",
      webUiPort: 3100,
      env: {},
      installedAt: "2026-02-24T00:00:00.000Z",
      updatedAt: "2026-02-24T00:00:00.000Z",
    });
    vi.mocked(createStoreOperation).mockResolvedValue(undefined);
    vi.mocked(updateStoreOperation).mockResolvedValue(undefined);
    vi.mocked(updateStackUpdateStatus).mockResolvedValue(undefined);

    let failed = false;
    const done = new Promise<void>((resolve) => {
      vi.mocked(updateStoreOperation).mockImplementation(async (_id, patch) => {
        if (!failed && patch.status === "error") {
          failed = true;
          resolve();
        }
      });
    });

    await startStoreOperation({
      appId: "example",
      action: "update",
    });

    await done;

    const composeAfterFailure = await readFile(composePath, "utf8");
    expect(composeAfterFailure).toBe(initialCompose);
    expect(runComposeUp).not.toHaveBeenCalled();

    await rm(tempDir, { recursive: true, force: true });
  });

  it("restores backup compose when update apply fails", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "store-update-rollback-"));
    const composePath = path.join(tempDir, "docker-compose.yml");
    const initialCompose = `services:\n  app:\n    image: ghcr.io/example/app:v1\n`;
    await writeFile(composePath, initialCompose, "utf8");

    vi.mocked(findStoreCatalogTemplateByAppId).mockResolvedValue({
      appId: "example",
      templateName: "example",
      name: "Example",
      description: "example",
      platform: "Docker",
      note: "note",
      categories: ["Tools"],
      logoUrl: null,
      port: null,
      repositoryUrl: "https://github.com/example/store",
      stackFile: "Apps/example/docker-compose.yml",
      env: [],
    });
    vi.mocked(findCustomStoreTemplateByAppId).mockResolvedValue(null);
    vi.mocked(fetchComposeFileFromGitHub).mockResolvedValue(`services:\n  app:\n    image: ghcr.io/example/app:v2\n`);
    vi.mocked(findInstalledStackByAppId).mockResolvedValue({
      appId: "example",
      templateName: "example",
      stackName: "example",
      composePath,
      status: "installed",
      webUiPort: 3100,
      env: {},
      installedAt: "2026-02-24T00:00:00.000Z",
      updatedAt: "2026-02-24T00:00:00.000Z",
    });
    vi.mocked(extractComposeImages).mockResolvedValue([]);
    vi.mocked(runComposeUp)
      .mockRejectedValueOnce(new Error("compose up failed"))
      .mockResolvedValueOnce(undefined);
    vi.mocked(createStoreOperation).mockResolvedValue(undefined);
    vi.mocked(updateStoreOperation).mockResolvedValue(undefined);
    vi.mocked(updateStackUpdateStatus).mockResolvedValue(undefined);

    let failed = false;
    const done = new Promise<void>((resolve) => {
      vi.mocked(updateStoreOperation).mockImplementation(async (_id, patch) => {
        if (!failed && patch.status === "error") {
          failed = true;
          resolve();
        }
      });
    });

    await startStoreOperation({
      appId: "example",
      action: "update",
    });

    await done;

    const composeAfterRollback = await readFile(composePath, "utf8");
    expect(composeAfterRollback).toBe(initialCompose);
    expect(runComposeUp).toHaveBeenCalledTimes(2);

    await rm(tempDir, { recursive: true, force: true });
  });
});
