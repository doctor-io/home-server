import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/store/catalog", () => ({
  findStoreCatalogTemplateByAppId: vi.fn(),
}));

vi.mock("@/lib/server/modules/store/compose-runner", () => ({
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

vi.mock("@/lib/server/modules/store/repository", () => ({
  createStoreOperation: vi.fn(),
  deleteInstalledStackByAppId: vi.fn(),
  findInstalledStackByAppId: vi.fn(),
  findStackByWebUiPort: vi.fn(),
  findStoreOperationById: vi.fn(),
  updateStoreOperation: vi.fn(),
  upsertInstalledStack: vi.fn(),
}));

import { findStoreCatalogTemplateByAppId } from "@/lib/server/modules/store/catalog";
import {
  cleanupComposeDataOnUninstall,
  extractComposeImages,
  materializeInlineStackFiles,
  materializeStackFiles,
  runComposeDown,
  runComposeUp,
} from "@/lib/server/modules/store/compose-runner";
import { findCustomStoreTemplateByAppId } from "@/lib/server/modules/store/custom-apps";
import { pullDockerImage } from "@/lib/server/modules/store/docker-client";
import {
  createStoreOperation,
  deleteInstalledStackByAppId,
  findInstalledStackByAppId,
  findStackByWebUiPort,
  updateStoreOperation,
  upsertInstalledStack,
} from "@/lib/server/modules/store/repository";
import {
  getLatestStoreOperationEvent,
  startStoreOperation,
} from "@/lib/server/modules/store/operations";

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
    vi.mocked(materializeInlineStackFiles).mockReset();
    vi.mocked(materializeStackFiles).mockReset();
    vi.mocked(extractComposeImages).mockReset();
    vi.mocked(pullDockerImage).mockReset();
    vi.mocked(runComposeUp).mockReset();
    vi.mocked(createStoreOperation).mockReset();
    vi.mocked(deleteInstalledStackByAppId).mockReset();
    vi.mocked(findInstalledStackByAppId).mockReset();
    vi.mocked(findStackByWebUiPort).mockReset();
    vi.mocked(updateStoreOperation).mockReset();
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

    const latest = await waitForLatestEventType(operationId, "operation.completed");
    expect(latest?.status).toBe("success");
  });
});
