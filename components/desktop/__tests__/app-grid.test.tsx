/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const useStoreActionsMock = vi.fn();
const useInstalledAppsMock = vi.fn();
const useStoreCatalogMock = vi.fn();

vi.mock("@/hooks/useStoreActions", () => ({
  useStoreActions: (...args: unknown[]) => useStoreActionsMock(...args),
}));
vi.mock("@/hooks/useInstalledApps", () => ({
  useInstalledApps: (...args: unknown[]) => useInstalledAppsMock(...args),
}));
vi.mock("@/hooks/useStoreCatalog", () => ({
  useStoreCatalog: (...args: unknown[]) => useStoreCatalogMock(...args),
}));

import { AppGrid } from "@/components/desktop/app-grid";

function openContextMenuFor(appName: string) {
  const iconButton = screen.getByRole("button", { name: `Open ${appName}` });
  fireEvent.contextMenu(iconButton, { clientX: 120, clientY: 120 });
}

describe("AppGrid context menu", () => {
  beforeEach(() => {
    useStoreActionsMock.mockReset();
    useInstalledAppsMock.mockReset();
    useStoreCatalogMock.mockReset();

    useStoreActionsMock.mockReturnValue({
      operationsByApp: {},
      uninstallApp: vi.fn().mockResolvedValue(undefined),
    });
    useInstalledAppsMock.mockReturnValue({
      data: [
        {
          id: "plex",
          name: "Plex",
          status: "running",
          webUiPort: 32400,
          containerName: "plex",
          updatedAt: "2026-02-24T00:00:00.000Z",
        },
      ],
      isLoading: false,
      isError: false,
    });
    useStoreCatalogMock.mockReturnValue({
      data: [
        {
          id: "plex",
          name: "Plex",
          description: "Plex media server",
          platform: "linux",
          categories: ["Media"],
          logoUrl: null,
          repositoryUrl: "https://example.com",
          stackFile: "Apps/plex/docker-compose.yml",
          status: "installed",
          webUiPort: 32400,
          updateAvailable: false,
          localDigest: null,
          remoteDigest: null,
        },
      ],
      isLoading: false,
      isError: false,
    });
  });

  it("opens dashboard with default url mapping", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<AppGrid animationsEnabled={false} />);

    openContextMenuFor("Plex");
    fireEvent.click(screen.getByRole("button", { name: "Open Dashboard" }));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        "http://localhost:32400",
        "_blank",
        "noopener,noreferrer",
      );
    });
  });

  it("prefers installed runtime port over catalog port for dashboard url", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    useInstalledAppsMock.mockReturnValue({
      data: [
        {
          id: "plex",
          name: "Plex",
          status: "running",
          webUiPort: 32410,
          containerName: "plex",
          updatedAt: "2026-02-24T00:00:00.000Z",
        },
      ],
      isLoading: false,
      isError: false,
    });

    render(<AppGrid animationsEnabled={false} />);

    openContextMenuFor("Plex");
    fireEvent.click(screen.getByRole("button", { name: "Open Dashboard" }));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        "http://localhost:32410",
        "_blank",
        "noopener,noreferrer",
      );
    });
  });

  it("routes open dashboard through callback when provided", async () => {
    const onOpenDashboard = vi.fn();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(
      <AppGrid
        animationsEnabled={false}
        onOpenDashboard={onOpenDashboard}
      />,
    );

    openContextMenuFor("Plex");
    fireEvent.click(screen.getByRole("button", { name: "Open Dashboard" }));

    await waitFor(() => {
      expect(onOpenDashboard).toHaveBeenCalledWith({
        appId: "plex",
        appName: "Plex",
        dashboardUrl: "http://localhost:32400",
        containerName: "plex",
      });
    });
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("opens dashboard without backend lookup", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(<AppGrid animationsEnabled={false} />);

    openContextMenuFor("Plex");
    fireEvent.click(screen.getByRole("button", { name: "Open Dashboard" }));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        "http://localhost:32400",
        "_blank",
        "noopener,noreferrer",
      );
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("routes logs, terminal, and settings actions through callbacks", async () => {
    const onViewLogs = vi.fn();
    const onOpenTerminal = vi.fn();
    const onOpenSettings = vi.fn();
    render(
      <AppGrid
        animationsEnabled={false}
        onViewLogs={onViewLogs}
        onOpenTerminal={onOpenTerminal}
        onOpenSettings={onOpenSettings}
      />,
    );

    openContextMenuFor("Plex");
    fireEvent.click(screen.getByRole("button", { name: "View Logs" }));
    await waitFor(() => {
      expect(onViewLogs).toHaveBeenCalledWith({
        appId: "plex",
        appName: "Plex",
        dashboardUrl: "http://localhost:32400",
        containerName: "plex",
      });
    });

    openContextMenuFor("Plex");
    fireEvent.click(screen.getByRole("button", { name: "Open in Terminal" }));
    await waitFor(() => {
      expect(onOpenTerminal).toHaveBeenCalledWith({
        appId: "plex",
        appName: "Plex",
        dashboardUrl: "http://localhost:32400",
        containerName: "plex",
      });
    });

    openContextMenuFor("Plex");
    fireEvent.click(screen.getByRole("button", { name: "App Settings" }));
    await waitFor(() => {
      expect(onOpenSettings).toHaveBeenCalledWith({
        appId: "plex",
        appName: "Plex",
        dashboardUrl: "http://localhost:32400",
        containerName: "plex",
      });
    });
  });

  it("does not route logs or terminal when container cannot be resolved", async () => {
    const onViewLogs = vi.fn();
    const onOpenTerminal = vi.fn();

    useInstalledAppsMock.mockReturnValue({
      data: [
        {
          id: "plex",
          name: "Plex",
          status: "running",
          webUiPort: 32400,
          containerName: null,
          updatedAt: "2026-02-24T00:00:00.000Z",
        },
      ],
      isLoading: false,
      isError: false,
    });

    render(
      <AppGrid
        animationsEnabled={false}
        onViewLogs={onViewLogs}
        onOpenTerminal={onOpenTerminal}
      />,
    );

    openContextMenuFor("Plex");
    fireEvent.click(screen.getByRole("button", { name: "View Logs" }));

    openContextMenuFor("Plex");
    fireEvent.click(screen.getByRole("button", { name: "Open in Terminal" }));
    expect(onViewLogs).not.toHaveBeenCalled();
    expect(onOpenTerminal).not.toHaveBeenCalled();
  });

  it("copies dashboard url with clipboard fallback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(<AppGrid animationsEnabled={false} />);

    openContextMenuFor("Plex");
    fireEvent.click(screen.getByRole("button", { name: "Copy URL" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("http://localhost:32400");
    });
  });

  it("toggles stop/start container actions", () => {
    render(<AppGrid animationsEnabled={false} />);

    openContextMenuFor("Plex");
    fireEvent.click(screen.getByRole("button", { name: "Stop Container" }));

    openContextMenuFor("Plex");
    expect(screen.getByRole("button", { name: "Start Container" })).toBeTruthy();
  });

  it("renders updating state from persisted active operation after refresh", () => {
    useInstalledAppsMock.mockReturnValue({
      data: [
        {
          id: "plex",
          name: "Plex",
          status: "running",
          activeOperation: {
            id: "op-redeploy-1",
            action: "redeploy",
            status: "running",
            progressPercent: 45,
            currentStep: "compose-up",
            updatedAt: "2026-02-24T00:00:05.000Z",
          },
          webUiPort: 32400,
          containerName: "plex",
          updatedAt: "2026-02-24T00:00:00.000Z",
        },
      ],
      isLoading: false,
      isError: false,
    });

    render(<AppGrid animationsEnabled={false} />);

    expect(
      screen.getByRole("button", { name: "Open Plex" }).getAttribute("data-app-status"),
    ).toBe("updating");
  });

  it("renders paused state for paused containers", () => {
    useInstalledAppsMock.mockReturnValue({
      data: [
        {
          id: "plex",
          name: "Plex",
          status: "paused",
          webUiPort: 32400,
          containerName: "plex",
          updatedAt: "2026-02-24T00:00:00.000Z",
        },
      ],
      isLoading: false,
      isError: false,
    });

    render(<AppGrid animationsEnabled={false} />);

    expect(
      screen.getByRole("button", { name: "Open Plex" }).getAttribute("data-app-status"),
    ).toBe("paused");
  });

  it("shows a global action banner for active operations", () => {
    useInstalledAppsMock.mockReturnValue({
      data: [
        {
          id: "plex",
          name: "Plex",
          status: "running",
          activeOperation: {
            id: "op-redeploy-1",
            action: "redeploy",
            status: "running",
            progressPercent: 45,
            currentStep: "compose-up",
            updatedAt: "2026-02-24T00:00:05.000Z",
          },
          webUiPort: 32400,
          containerName: "plex",
          updatedAt: "2026-02-24T00:00:00.000Z",
        },
      ],
      isLoading: false,
      isError: false,
    });

    render(<AppGrid animationsEnabled={false} />);

    expect(screen.getByText("Redeploying Plex")).toBeTruthy();
    expect(screen.getByText("45%")).toBeTruthy();
  });

  it("shows a loader skeleton while apps are loading", () => {
    useInstalledAppsMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });
    useStoreCatalogMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    const { container } = render(<AppGrid animationsEnabled={false} />);

    expect(screen.getByText("Loading installed apps")).toBeTruthy();
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });

  it("opens uninstall dialog and triggers backend uninstall from remove action", async () => {
    const uninstallApp = vi.fn().mockResolvedValue(undefined);
    useStoreActionsMock.mockReturnValue({
      operationsByApp: {},
      uninstallApp,
    });

    render(<AppGrid animationsEnabled={false} />);

    expect(screen.getByRole("button", { name: "Open Plex" })).toBeTruthy();
    openContextMenuFor("Plex");
    fireEvent.click(screen.getByRole("button", { name: "Remove App" }));

    expect(screen.getByText("Uninstall Plex?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Uninstall" }));

    await waitFor(() => {
      expect(uninstallApp).toHaveBeenCalledWith({
        appId: "plex",
        removeVolumes: false,
      });
    });
  });

  it("keeps restart and update actions available after check-updates request", async () => {
    const checkAppUpdates = vi.fn().mockResolvedValue({
      appId: "plex",
      operationId: "op-1",
      action: "check-updates",
    });
    useStoreActionsMock.mockReturnValue({
      operationsByApp: {},
      uninstallApp: vi.fn().mockResolvedValue(undefined),
      checkAppUpdates,
      restartApp: vi.fn().mockResolvedValue({
        appId: "plex",
        operationId: "op-2",
        action: "restart",
      }),
      startApp: vi.fn(),
      stopApp: vi.fn(),
    });

    render(<AppGrid animationsEnabled={false} />);

    openContextMenuFor("Plex");
    fireEvent.click(screen.getByRole("button", { name: "Check Updates" }));
    await waitFor(() => {
      expect(checkAppUpdates).toHaveBeenCalledWith("plex");
    });

    openContextMenuFor("Plex");
    const restartButton = screen.getByRole("button", { name: "Restart Container" });
    const updatesButton = screen.getByRole("button", { name: "Check Updates" });
    expect((restartButton as HTMLButtonElement).disabled).toBe(false);
    expect((updatesButton as HTMLButtonElement).disabled).toBe(false);
  });

  it("does not open the home page when dashboard url cannot be resolved", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    useInstalledAppsMock.mockReturnValue({
      data: [
        {
          id: "unknown-app",
          name: "Unknown App",
          status: "running",
          webUiPort: null,
          updatedAt: "2026-02-24T00:00:00.000Z",
        },
      ],
      isLoading: false,
      isError: false,
    });
    useStoreCatalogMock.mockReturnValue({
      data: [
        {
          id: "unknown-app",
          name: "Unknown App",
          description: "No known dashboard",
          platform: "linux",
          categories: ["Misc"],
          logoUrl: null,
          repositoryUrl: "https://example.com",
          stackFile: "Apps/unknown-app/docker-compose.yml",
          status: "installed",
          webUiPort: null,
          updateAvailable: false,
          localDigest: null,
          remoteDigest: null,
        },
      ],
      isLoading: false,
      isError: false,
    });

    render(<AppGrid animationsEnabled={false} />);

    openContextMenuFor("Unknown App");
    const openButton = screen.getByRole("button", { name: "Open Dashboard" });
    expect((openButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(openButton);

    expect(openSpy).not.toHaveBeenCalled();
  });

});
