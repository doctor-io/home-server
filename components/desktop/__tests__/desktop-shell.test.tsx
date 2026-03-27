/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { writePersistedPowerActionCompletion } from "@/lib/desktop/reboot-state";

const { toastSuccessMock } = vi.hoisted(() => ({
  toastSuccessMock: vi.fn(),
}));

const useCurrentUserMock = vi.fn();
const useDesktopAppearanceMock = vi.fn();
const useRebootRecoveryMock = vi.fn();
const useStoreCatalogMock = vi.fn();
const routerReplaceMock = vi.fn();
const routerRefreshMock = vi.fn();

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplaceMock,
    refresh: routerRefreshMock,
  }),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  CurrentUserError: class CurrentUserError extends Error {
    readonly status: number;
    readonly redirectTo?: string;

    constructor(message: string, status: number, redirectTo?: string) {
      super(message);
      this.name = "CurrentUserError";
      this.status = status;
      this.redirectTo = redirectTo;
    }
  },
  useCurrentUser: () => useCurrentUserMock(),
}));

vi.mock("@/modules/shell/hooks/useDesktopAppearance", () => ({
  useDesktopAppearance: () => useDesktopAppearanceMock(),
}));

vi.mock("@/modules/shell/hooks/useRebootRecovery", () => ({
  useRebootRecovery: () => useRebootRecoveryMock(),
}));

vi.mock("@/modules/apps/hooks/useStoreCatalog", () => ({
  useStoreCatalog: (...args: unknown[]) => useStoreCatalogMock(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
  },
}));

vi.mock("@/modules/apps/components/app-grid", () => ({
  AppGrid: () => <div>AppGrid</div>,
}));
vi.mock("@/modules/apps/components/app-store", () => ({
  AppStore: () => <div>AppStore</div>,
}));
vi.mock("@/modules/apps/components/configurator/app-configurator-panel", () => ({
  AppConfiguratorPanel: () => <div>AppConfiguratorPanel</div>,
}));
vi.mock("@/modules/shell/components/dock", () => ({
  Dock: ({
    activeWindows,
    focusedWindow,
    onItemClick,
  }: {
    activeWindows?: string[];
    focusedWindow?: string | null;
    onItemClick?: (id: string) => void;
  }) => (
    <div>
      <div data-testid="dock-state">
        {JSON.stringify({ activeWindows, focusedWindow })}
      </div>
      <button onClick={() => onItemClick?.("app-store")}>Dock App Store</button>
      <button onClick={() => onItemClick?.("settings")}>Dock Settings</button>
    </div>
  ),
}));
vi.mock("@/modules/files/components/file-manager", () => ({
  FileManager: () => <div>FileManager</div>,
}));
vi.mock("@/modules/shell/components/lock-screen", () => ({
  LockScreen: () => <div>LockScreen</div>,
}));
vi.mock("@/modules/system/components/monitor", () => ({
  Monitor: () => <div>Monitor</div>,
}));
vi.mock("@/modules/settings/components/settings", () => ({
  SettingsPanel: () => <div>SettingsPanel</div>,
}));
vi.mock("@/modules/system/components/status-bar", () => ({
  StatusBar: () => <div>StatusBar</div>,
}));
vi.mock("@/modules/system/components/system-widgets", () => ({
  SystemWidgets: () => <div>SystemWidgets</div>,
}));
vi.mock("@/modules/shell/components/terminal", () => ({
  Terminal: () => <div>Terminal</div>,
}));
vi.mock("@/modules/shell/components/window", () => ({
  Window: ({
    children,
    title,
    onMinimize,
    isMinimized,
  }: {
    children: ReactNode;
    title: string;
    onMinimize?: () => void;
    isMinimized?: boolean;
  }) => (
    <div data-testid={`window-${title}`}>
      <button onClick={onMinimize}>Minimize {title}</button>
      <div data-testid={`window-${title}-state`}>
        {JSON.stringify({ isMinimized })}
      </div>
      {!isMinimized ? children : null}
    </div>
  ),
}));

import { DesktopShell } from "@/modules/shell/components/desktop-shell";

describe("DesktopShell reboot handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    Element.prototype.scrollIntoView = vi.fn();
    useStoreCatalogMock.mockReturnValue({
      data: {
        apps: [
          {
            id: "grafana",
            name: "Grafana",
            description: "Dashboards and observability",
            platform: "linux",
            categories: ["Monitoring"],
            logoUrl: null,
            repositoryUrl: "https://example.com/grafana",
            stackFile: "grafana/docker-compose.yml",
            status: "not_installed",
            webUiPort: 3000,
            updateAvailable: false,
            localDigest: null,
            remoteDigest: null,
            image: null,
            sourceId: "official",
            sourceName: "Official",
            sourceKind: "official",
          },
        ],
        categories: [],
        featuredAppIds: [],
        recommendedAppIds: [],
        sourcePath: "/tmp/catalog.json",
        sources: [],
      },
      isLoading: false,
    });

    useDesktopAppearanceMock.mockReturnValue({
      appearance: {
        theme: "dark",
        wallpaper: "/images/1.jpg",
        accentColor: "oklch(0.72 0.14 190)",
        radius: 14,
        iconSize: "medium",
        dockPosition: "bottom",
        fontSize: "default",
        animationsEnabled: true,
      },
      updateAppearance: vi.fn(),
      wallpapers: [],
      accentColors: [],
      appIconSize: "medium",
    });
  });

  it("shows reboot overlay when recovery state is active", async () => {
    useCurrentUserMock.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
      isError: false,
    });
    useRebootRecoveryMock.mockReturnValue({
      isHydrated: true,
      isActive: true,
      action: "reboot",
      phase: "waiting",
      startedAt: new Date().toISOString(),
    });

    render(<DesktopShell />);

    expect(
      screen.getByText("Waiting for server to restart..."),
    ).toBeTruthy();
    expect(screen.queryByText("Loading session...")).toBeNull();
  });

  it("suppresses login redirect while reboot recovery is active", async () => {
    useCurrentUserMock.mockReturnValue({
      data: undefined,
      error: new Error("network down"),
      isLoading: false,
      isError: true,
    });
    useRebootRecoveryMock.mockReturnValue({
      isHydrated: true,
      isActive: true,
      action: "factory-reset",
      phase: "reconnecting",
      startedAt: new Date().toISOString(),
    });

    render(<DesktopShell />);

    await waitFor(() => {
      expect(routerReplaceMock).not.toHaveBeenCalled();
    });
  });

  it("shows the Homeio update overlay while update recovery is active", () => {
    useCurrentUserMock.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
      isError: false,
    });
    useRebootRecoveryMock.mockReturnValue({
      isHydrated: true,
      isActive: true,
      action: "update",
      phase: "waiting",
      startedAt: new Date().toISOString(),
    });

    render(<DesktopShell />);

    expect(screen.getByText("Applying Homeio update...")).toBeTruthy();
  });

  it("shows the blurred session loading screen while the user is loading", () => {
    useCurrentUserMock.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
      isError: false,
    });
    useRebootRecoveryMock.mockReturnValue({
      isHydrated: true,
      isActive: false,
      action: null,
      phase: "reconnecting",
      startedAt: null,
    });

    render(<DesktopShell />);

    expect(screen.getByText("Loading session...")).toBeTruthy();
    expect(
      screen.getByText(
        "Preparing your desktop, restoring preferences, and reconnecting Homeio services now.",
      ),
    ).toBeTruthy();
  });

  it("shows a success toast after an update completed", async () => {
    useCurrentUserMock.mockReturnValue({
      data: {
        id: "u1",
        username: "ahmed",
      },
      error: null,
      isLoading: false,
      isError: false,
    });
    useRebootRecoveryMock.mockReturnValue({
      isHydrated: true,
      isActive: false,
      action: null,
      phase: "reconnecting",
      startedAt: null,
    });

    writePersistedPowerActionCompletion(localStorage, {
      action: "update",
      completedAt: new Date().toISOString(),
    });

    render(<DesktopShell />);

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Homeio update completed.");
    });
    expect(localStorage.getItem("system.power.action.completed.v1")).toBeNull();
  });

  it("focuses an open window from the dock instead of closing it", async () => {
    useCurrentUserMock.mockReturnValue({
      data: {
        id: "u1",
        username: "ahmed",
      },
      error: null,
      isLoading: false,
      isError: false,
    });
    useRebootRecoveryMock.mockReturnValue({
      isHydrated: true,
      isActive: false,
      action: null,
      phase: "reconnecting",
      startedAt: null,
    });

    render(<DesktopShell />);

    fireEvent.click(screen.getByRole("button", { name: "Dock App Store" }));
    fireEvent.click(screen.getByRole("button", { name: "Dock Settings" }));

    expect(screen.getByText("AppStore")).toBeTruthy();
    expect(screen.getByText("SettingsPanel")).toBeTruthy();
    expect(screen.getByTestId("dock-state").textContent).toContain(
      '"focusedWindow":"settings"',
    );

    fireEvent.click(screen.getByRole("button", { name: "Dock App Store" }));

    expect(screen.getByText("AppStore")).toBeTruthy();
    expect(screen.getByText("SettingsPanel")).toBeTruthy();
    expect(screen.getByTestId("dock-state").textContent).toContain(
      '"focusedWindow":"app-store"',
    );
  });

  it("clears dock focus when the last visible window is minimized", async () => {
    useCurrentUserMock.mockReturnValue({
      data: {
        id: "u1",
        username: "ahmed",
      },
      error: null,
      isLoading: false,
      isError: false,
    });
    useRebootRecoveryMock.mockReturnValue({
      isHydrated: true,
      isActive: false,
      action: null,
      phase: "reconnecting",
      startedAt: null,
    });

    render(<DesktopShell />);

    fireEvent.click(screen.getByRole("button", { name: "Dock App Store" }));

    expect(screen.getByText("AppStore")).toBeTruthy();
    expect(screen.getByTestId("dock-state").textContent).toContain(
      '"focusedWindow":"app-store"',
    );

    fireEvent.click(screen.getByRole("button", { name: "Minimize App Store" }));

    expect(screen.queryByText("AppStore")).toBeNull();
    expect(screen.getByTestId("dock-state").textContent).toContain(
      '"activeWindows":["app-store"]',
    );
    expect(screen.getByTestId("dock-state").textContent).toContain(
      '"focusedWindow":null',
    );
  });

  it("restores a minimized window from the dock", async () => {
    useCurrentUserMock.mockReturnValue({
      data: {
        id: "u1",
        username: "ahmed",
      },
      error: null,
      isLoading: false,
      isError: false,
    });
    useRebootRecoveryMock.mockReturnValue({
      isHydrated: true,
      isActive: false,
      action: null,
      phase: "reconnecting",
      startedAt: null,
    });

    render(<DesktopShell />);

    fireEvent.click(screen.getByRole("button", { name: "Dock App Store" }));
    fireEvent.click(screen.getByRole("button", { name: "Minimize App Store" }));

    expect(screen.queryByText("AppStore")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Dock App Store" }));

    expect(screen.getByText("AppStore")).toBeTruthy();
    expect(screen.getByTestId("dock-state").textContent).toContain(
      '"focusedWindow":"app-store"',
    );
  });

  it("opens the command palette with Cmd+K and shows app store search results", async () => {
    useCurrentUserMock.mockReturnValue({
      data: {
        id: "u1",
        username: "ahmed",
      },
      error: null,
      isLoading: false,
      isError: false,
    });
    useRebootRecoveryMock.mockReturnValue({
      isHydrated: true,
      isActive: false,
      action: null,
      phase: "reconnecting",
      startedAt: null,
    });

    render(<DesktopShell />);

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    expect(screen.getAllByText("Search Homeio").length).toBeGreaterThan(0);
    expect(screen.getByText("Open App Store")).toBeTruthy();
    expect(screen.getByText("Grafana")).toBeTruthy();
  });

  it("shows recent actions in the command palette after a dock action", async () => {
    useCurrentUserMock.mockReturnValue({
      data: {
        id: "u1",
        username: "ahmed",
      },
      error: null,
      isLoading: false,
      isError: false,
    });
    useRebootRecoveryMock.mockReturnValue({
      isHydrated: true,
      isActive: false,
      action: null,
      phase: "reconnecting",
      startedAt: null,
    });

    render(<DesktopShell />);

    fireEvent.click(screen.getByRole("button", { name: "Dock App Store" }));
    fireEvent.keyDown(window, { key: "k", metaKey: true });

    expect(screen.getAllByText("Recent").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Open App Store").length).toBeGreaterThan(1);
  });
});
