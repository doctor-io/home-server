/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppOperationState } from "@/hooks/useStoreActions";
import type { InstalledStackConfig, StoreAppDetail, StoreAppSummary } from "@/lib/shared/contracts/apps";

const useStoreCatalogMock = vi.fn();
const useStoreAppMock = vi.fn();
const useStoreActionsMock = vi.fn();
const useStoreOperationMock = vi.fn();
const useAppComposeMock = vi.fn();

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

vi.mock("@/hooks/useAppCompose", () => ({
  useAppCompose: (...args: unknown[]) => useAppComposeMock(...args),
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
  stackFile: "Apps/Plex/docker-compose.yml",
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

const installedConfig: InstalledStackConfig = {
  appId: "plex",
  templateName: "plex",
  stackName: "plex-stack",
  composePath: "/tmp/stacks/plex/docker-compose.yml",
  status: "installed",
  webUiPort: 32400,
  env: {
    TZ: "UTC",
  },
  displayName: null,
  iconUrl: null,
  installedAt: "2026-02-23T10:00:00.000Z",
  updatedAt: "2026-02-23T10:00:00.000Z",
  isUpToDate: true,
  lastUpdateCheck: null,
  localDigest: null,
  remoteDigest: null,
};

const appDetail: StoreAppDetail = {
  ...installedSummaryApp,
  note: "Install Plex from CasaOS.",
  env: [
    {
      name: "TZ",
      label: "Timezone",
      default: "UTC",
      description: "Timezone used by the container",
    },
  ],
  screenshots: ["https://cdn.example.com/plex-shot.png"],
  installedConfig,
};

const updatableAppDetail: StoreAppDetail = {
  ...appDetail,
  ...updatableSummaryApp,
};

function setup({
  apps = [summaryApp],
  detail = null,
  operationsByApp = {},
  categories = [{ id: "media", name: "Media", description: "Media apps", appCount: apps.length }],
  featuredAppIds = [apps[0]?.id].filter(Boolean) as string[],
  recommendedAppIds = [apps[0]?.id].filter(Boolean) as string[],
  onOpenCustomInstall = () => {},
}: {
  apps?: StoreAppSummary[];
  detail?: StoreAppDetail | null;
  operationsByApp?: Record<string, AppOperationState>;
  categories?: Array<{ id: string; name: string; description: string; appCount: number }>;
  featuredAppIds?: string[];
  recommendedAppIds?: string[];
  onOpenCustomInstall?: () => void;
} = {}) {
  const installApp = vi.fn().mockResolvedValue(undefined);
  const installCustomApp = vi.fn().mockResolvedValue(undefined);
  const updateApp = vi.fn().mockResolvedValue(undefined);
  const redeployApp = vi.fn().mockResolvedValue(undefined);
  const uninstallApp = vi.fn().mockResolvedValue(undefined);

  useStoreCatalogMock.mockReturnValue({
    data: {
      apps,
      categories,
      featuredAppIds,
      recommendedAppIds,
      sourcePath: "/DATA/AppStore/CasaOS-AppStore",
    },
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
    updateApp,
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
  useAppComposeMock.mockReturnValue({
    data: null,
    isLoading: false,
    isError: false,
    error: null,
  });

  render(<AppStore onOpenCustomInstall={onOpenCustomInstall} />);

  return {
    installApp,
    installCustomApp,
    updateApp,
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
    useAppComposeMock.mockReset();
  });

  it("renders CasaOS catalog sections and category sidebar", () => {
    setup();

    expect(screen.getAllByText("Plex").length).toBeGreaterThan(0);
    expect(screen.getAllByAltText("Plex logo").length).toBeGreaterThan(0);
    expect(screen.getByText("Categories")).toBeTruthy();
    expect(screen.getByText("Featured Apps")).toBeTruthy();
    expect(screen.getByText("Recommended for You")).toBeTruthy();
    expect(screen.getByTitle("Media apps")).toBeTruthy();
  });

  it("falls back to generic icon when logo fails", () => {
    setup();

    const image = screen.getAllByAltText("Plex logo")[0];
    fireEvent.error(image);

    expect(screen.getAllByLabelText(/fallback/i).length).toBeGreaterThan(0);
  });

  it("triggers install action from list", () => {
    const { installApp } = setup();

    fireEvent.click(screen.getAllByRole("button", { name: /^install$/i })[0]);

    expect(installApp).toHaveBeenCalledWith({ appId: "plex" });
  });

  it("triggers redeploy and uninstall from detail actions", async () => {
    const { redeployApp, uninstallApp } = setup({
      apps: [installedSummaryApp],
      detail: appDetail,
      featuredAppIds: [],
      recommendedAppIds: [],
    });

    fireEvent.click(screen.getByRole("button", { name: /plex/i }));
    fireEvent.click(screen.getByRole("button", { name: /redeploy/i }));
    fireEvent.click(screen.getByRole("button", { name: /uninstall/i }));

    expect(screen.getByText("Screenshots")).toBeTruthy();
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

  it("shows update action and triggers update when update is available", () => {
    const { updateApp } = setup({
      apps: [updatableSummaryApp],
      detail: updatableAppDetail,
      featuredAppIds: [],
      recommendedAppIds: [],
    });

    fireEvent.click(screen.getAllByRole("button", { name: /^update$/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /plex/i }));
    fireEvent.click(screen.getByRole("button", { name: /^update$/i }));

    expect(screen.getByText("Update available")).toBeTruthy();
    expect(updateApp).toHaveBeenCalledWith({ appId: "plex" });
  });

  it("opens custom install settings panel from app detail", () => {
    setup({
      apps: [installedSummaryApp],
      detail: appDetail,
      featuredAppIds: [],
      recommendedAppIds: [],
    });

    fireEvent.click(screen.getByRole("button", { name: /plex/i }));
    fireEvent.click(screen.getByRole("button", { name: /custom install/i }));

    expect(screen.getByText("Install Plex")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /close install settings/i }));
    expect(screen.queryByText("Install Plex")).toBeNull();
  });
});
