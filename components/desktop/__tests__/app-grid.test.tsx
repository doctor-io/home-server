/* @vitest-environment jsdom */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("opens dashboard with default url mapping", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<AppGrid animationsEnabled={false} />);

    openContextMenuFor("Plex");
    fireEvent.click(screen.getByRole("button", { name: "Open Dashboard" }));

    expect(openSpy).toHaveBeenCalledWith(
      "http://localhost:32400/web",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("routes open dashboard through callback when provided", () => {
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

    expect(onOpenDashboard).toHaveBeenCalledWith({
      appId: "plex",
      appName: "Plex",
      dashboardUrl: "http://localhost:32400/web",
      containerName: "plex",
    });
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("routes logs, terminal, and settings actions through callbacks", () => {
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
    expect(onViewLogs).toHaveBeenCalledWith({
      appId: "plex",
      appName: "Plex",
      dashboardUrl: "http://localhost:32400/web",
      containerName: "plex",
    });

    openContextMenuFor("Plex");
    fireEvent.click(screen.getByRole("button", { name: "Open in Terminal" }));
    expect(onOpenTerminal).toHaveBeenCalledWith({
      appId: "plex",
      appName: "Plex",
      dashboardUrl: "http://localhost:32400/web",
      containerName: "plex",
    });

    openContextMenuFor("Plex");
    fireEvent.click(screen.getByRole("button", { name: "App Settings" }));
    expect(onOpenSettings).toHaveBeenCalledWith({
      appId: "plex",
      appName: "Plex",
      dashboardUrl: "http://localhost:32400/web",
      containerName: "plex",
    });
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
      expect(writeText).toHaveBeenCalledWith("http://localhost:32400/web");
    });
  });

  it("toggles stop/start container actions", () => {
    render(<AppGrid animationsEnabled={false} />);

    openContextMenuFor("Plex");
    fireEvent.click(screen.getByRole("button", { name: "Stop Container" }));

    openContextMenuFor("Plex");
    expect(screen.getByRole("button", { name: "Start Container" })).toBeTruthy();
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

  it("disables restart and update while app is updating", () => {
    vi.useFakeTimers();
    render(<AppGrid animationsEnabled={false} />);

    openContextMenuFor("Plex");
    fireEvent.click(screen.getByRole("button", { name: "Check Updates" }));

    openContextMenuFor("Plex");
    const restartButton = screen.getByRole("button", { name: "Restart Container" });
    const updatesButton = screen.getByRole("button", { name: "Check Updates" });
    expect((restartButton as HTMLButtonElement).disabled).toBe(true);
    expect((updatesButton as HTMLButtonElement).disabled).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    openContextMenuFor("Plex");
    expect(
      (screen.getByRole("button", { name: "Restart Container" }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(
      (screen.getByRole("button", { name: "Check Updates" }) as HTMLButtonElement).disabled,
    ).toBe(false);
    vi.useRealTimers();
  });

});
