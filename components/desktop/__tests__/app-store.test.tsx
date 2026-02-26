/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppOperationState } from "@/hooks/useStoreActions";
import type { StoreAppDetail, StoreAppSummary } from "@/lib/shared/contracts/apps";

const useStoreCatalogMock = vi.fn();
const useStoreAppMock = vi.fn();
const useStoreActionsMock = vi.fn();
const useStoreOperationMock = vi.fn();

vi.mock("@/hooks/useStoreCatalog", () => ({
  useStoreCatalog: (...args: unknown[]) => useStoreCatalogMock(...args),
}));

vi.mock("@/hooks/useStoreApp", () => ({
  useStoreApp: (...args: unknown[]) => useStoreAppMock(...args),
}));

vi.mock("@/hooks/useStoreActions", () => ({
  useStoreActions: (...args: unknown[]) => useStoreActionsMock(...args),
}));

vi.mock("@/hooks/useStoreOperation", () => ({
  useStoreOperation: (...args: unknown[]) => useStoreOperationMock(...args),
}));

import { AppStore } from "@/components/desktop/app-store";

const summaryApp: StoreAppSummary = {
  id: "plex",
  name: "Plex",
  description: "Media server",
  platform: "Docker",
  categories: ["Media"],
  logoUrl: "https://cdn.example.com/plex.png",
  repositoryUrl: "https://github.com/plex",
  stackFile: "plex/docker-compose.yml",
  status: "not_installed",
  webUiPort: null,
  updateAvailable: false,
  localDigest: null,
  remoteDigest: null,
};

const installedSummaryApp: StoreAppSummary = {
  ...summaryApp,
  status: "installed",
  webUiPort: 32400,
};

const updatableSummaryApp: StoreAppSummary = {
  ...installedSummaryApp,
  updateAvailable: true,
  localDigest: "sha256:111",
  remoteDigest: "sha256:222",
};

const appDetail: StoreAppDetail = {
  ...installedSummaryApp,
  note: "Install Plex from BigBear",
  env: [
    {
      name: "TZ",
      label: "Timezone",
      default: "UTC",
      description: "Timezone used by the container",
    },
  ],
  installedConfig: {
    appId: "plex",
    templateName: "plex",
    stackName: "plex-stack",
    composePath: "/tmp/stacks/plex/docker-compose.yml",
    status: "installed",
    webUiPort: 32400,
    env: {
      TZ: "UTC",
    },
    installedAt: "2026-02-23T10:00:00.000Z",
    updatedAt: "2026-02-23T10:00:00.000Z",
  },
};

const updatableAppDetail: StoreAppDetail = {
  ...appDetail,
  ...updatableSummaryApp,
};

function setup({
  apps = [summaryApp],
  detail = null,
  operationsByApp = {},
}: {
  apps?: StoreAppSummary[];
  detail?: StoreAppDetail | null;
  operationsByApp?: Record<string, AppOperationState>;
} = {}) {
  const installApp = vi.fn().mockResolvedValue(undefined);
  const installCustomApp = vi.fn().mockResolvedValue(undefined);
  const redeployApp = vi.fn().mockResolvedValue(undefined);
  const uninstallApp = vi.fn().mockResolvedValue(undefined);

  useStoreCatalogMock.mockReturnValue({
    data: apps,
    isLoading: false,
    isError: false,
  });
  useStoreAppMock.mockReturnValue({
    data: detail,
    isLoading: false,
  });
  useStoreActionsMock.mockReturnValue({
    operationsByApp,
    installApp,
    installCustomApp,
    redeployApp,
    uninstallApp,
  });
  useStoreOperationMock.mockReturnValue({
    operation: null,
    latestEvent: null,
    isLoading: false,
    isError: false,
    error: null,
  });

  render(<AppStore onOpenCustomInstall={() => {}} />);

  return {
    installApp,
    installCustomApp,
    redeployApp,
    uninstallApp,
  };
}

describe("AppStore", () => {
  beforeEach(() => {
    useStoreCatalogMock.mockReset();
    useStoreAppMock.mockReset();
    useStoreActionsMock.mockReset();
    useStoreOperationMock.mockReset();
  });

  it("renders backend apps with logo and hides unsupported tabs/metrics", () => {
    setup();

    expect(screen.getByText("Plex")).toBeTruthy();
    expect(screen.getByAltText("Plex logo")).toBeTruthy();
    expect(screen.queryByText("Categories")).toBeNull();
    expect(screen.queryByText("Updates")).toBeNull();
    expect(screen.queryByText("Downloads")).toBeNull();
    expect(screen.queryByText("Developer")).toBeNull();
    expect(screen.queryByText("Size")).toBeNull();
  });

  it("falls back to generic icon when logo fails", () => {
    setup();

    const image = screen.getByAltText("Plex logo");
    fireEvent.error(image);

    expect(screen.getByLabelText("app-logo-fallback")).toBeTruthy();
  });

  it("triggers install action from list", () => {
    const { installApp } = setup();

    fireEvent.click(screen.getByRole("button", { name: /^install$/i }));

    expect(installApp).toHaveBeenCalledWith({ appId: "plex" });
  });

  it("triggers redeploy and uninstall from detail actions", async () => {
    const { redeployApp, uninstallApp } = setup({
      apps: [installedSummaryApp],
      detail: appDetail,
    });

    fireEvent.click(screen.getByRole("button", { name: /plex/i }));
    fireEvent.click(screen.getByRole("button", { name: /redeploy/i }));
    fireEvent.click(screen.getByRole("button", { name: /uninstall/i }));

    expect(screen.queryByText("Configuration")).toBeNull();
    expect(screen.getByText("Platform")).toBeTruthy();
    expect(screen.getByText("Docker")).toBeTruthy();
    expect(screen.getByText("https://github.com/plex")).toBeTruthy();
    expect(screen.getByText("Uninstall Plex?")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Uninstall" }));

    expect(redeployApp).toHaveBeenCalledWith({ appId: "plex" });

    await waitFor(() => {
      expect(uninstallApp).toHaveBeenCalledWith({
        appId: "plex",
        removeVolumes: false,
      });
    });
  });

  it("shows update action and triggers redeploy when update is available", () => {
    const { redeployApp } = setup({
      apps: [updatableSummaryApp],
      detail: updatableAppDetail,
    });

    fireEvent.click(screen.getByRole("button", { name: /^update$/i }));
    fireEvent.click(screen.getByRole("button", { name: /plex/i }));
    fireEvent.click(screen.getByRole("button", { name: /^update$/i }));

    expect(screen.getByText("Update available")).toBeTruthy();
    expect(redeployApp).toHaveBeenCalledWith({ appId: "plex" });
  });

  it("opens custom install settings panel from app detail", () => {
    setup({
      apps: [installedSummaryApp],
      detail: appDetail,
    });

    fireEvent.click(screen.getByRole("button", { name: /plex/i }));
    fireEvent.click(screen.getByRole("button", { name: /custom install/i }));

    expect(screen.getByText("Plex Settings")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /close.*install.*settings/i }));
    expect(screen.queryByText("Plex Settings")).toBeNull();
  });

  it("shows operation progress from backend state", () => {
    setup({
      operationsByApp: {
        plex: {
          operationId: "op-1",
          appId: "plex",
          action: "install",
          status: "running",
          progressPercent: 42,
          step: "Pulling image layers",
          message: null,
        },
      },
    });

    expect(screen.getByText("Pulling image layers • 42%")).toBeTruthy();
  });

  it("opens custom install dialog from menu and submits custom app payload", async () => {
    const { installCustomApp } = setup();

    fireEvent.click(screen.getByRole("button", { name: /install menu/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /install custom app/i }));

    fireEvent.change(screen.getByLabelText("App Name"), { target: { value: "My Custom App" } });
    fireEvent.change(screen.getByLabelText("Icon URL"), { target: { value: "https://example.com/icon.png" } });
    fireEvent.change(screen.getByLabelText("Web UI Port"), { target: { value: "8088" } });
    fireEvent.change(screen.getByLabelText("Docker Compose"), {
      target: { value: "services:\n  app:\n    image: nginx:latest" },
    });
    fireEvent.click(screen.getByRole("button", { name: /install custom app/i }));

    await waitFor(() => {
      expect(installCustomApp).toHaveBeenCalledWith({
        name: "My Custom App",
        iconUrl: "https://example.com/icon.png",
        webUiPort: 8088,
        repositoryUrl: undefined,
        sourceType: "docker-compose",
        source: "services:\n  app:\n    image: nginx:latest",
      });
    });
  });

  it("shows action error banner in list when install request fails", async () => {
    const installApp = vi.fn().mockRejectedValue(new Error("Unable to start install operation"));
    useStoreCatalogMock.mockReturnValue({
      data: [summaryApp],
      isLoading: false,
      isError: false,
    });
    useStoreAppMock.mockReturnValue({
      data: null,
      isLoading: false,
    });
    useStoreActionsMock.mockReturnValue({
      operationsByApp: {},
      installApp,
      installCustomApp: vi.fn(),
      redeployApp: vi.fn(),
      uninstallApp: vi.fn(),
    });
    useStoreOperationMock.mockReturnValue({
      operation: null,
      latestEvent: null,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<AppStore onOpenCustomInstall={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /^install$/i }));

    await waitFor(() => {
      expect(screen.getByText("Unable to start install operation")).toBeTruthy();
    });
  });
});
