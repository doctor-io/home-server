/* @vitest-environment jsdom */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoreAppSummary } from "@/lib/shared/contracts/apps";

const useStoreCatalogMock = vi.fn();

vi.mock("@/hooks/useStoreCatalog", () => ({
  useStoreCatalog: (...args: unknown[]) => useStoreCatalogMock(...args),
}));

import { AppGrid } from "@/components/desktop/app-grid";

const installedAppsFixture: StoreAppSummary[] = [
  {
    id: "plex",
    name: "Plex",
    description: "Media server",
    platform: "Docker",
    categories: ["Media"],
    logoUrl: null,
    repositoryUrl: "https://github.com/plexinc/pms-docker",
    stackFile: "Apps/Plex/docker-compose.yml",
    status: "installed",
    webUiPort: 32400,
    updateAvailable: false,
    localDigest: null,
    remoteDigest: null,
  },
];

function openContextMenuFor(appName: string) {
  const iconButton = screen.getByRole("button", { name: `Open ${appName}` });
  fireEvent.contextMenu(iconButton, { clientX: 120, clientY: 120 });
}

describe("AppGrid context menu", () => {
  beforeEach(() => {
    useStoreCatalogMock.mockReset();
    useStoreCatalogMock.mockReturnValue({
      data: installedAppsFixture,
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
      appName: "Plex",
      dashboardUrl: "http://localhost:32400/web",
      containerName: "plex",
    });

    openContextMenuFor("Plex");
    fireEvent.click(screen.getByRole("button", { name: "Open in Terminal" }));
    expect(onOpenTerminal).toHaveBeenCalledWith({
      appName: "Plex",
      dashboardUrl: "http://localhost:32400/web",
      containerName: "plex",
    });

    openContextMenuFor("Plex");
    fireEvent.click(screen.getByRole("button", { name: "App Settings" }));
    expect(onOpenSettings).toHaveBeenCalledWith({
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

  it("removes app from grid when remove action is clicked", () => {
    render(<AppGrid animationsEnabled={false} />);

    expect(screen.getByRole("button", { name: "Open Plex" })).toBeTruthy();
    openContextMenuFor("Plex");
    fireEvent.click(screen.getByRole("button", { name: "Remove App" }));

    expect(screen.queryByRole("button", { name: "Open Plex" })).toBeNull();
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

  it("shows empty state when no installed apps exist", () => {
    useStoreCatalogMock.mockReturnValueOnce({
      data: [],
      isLoading: false,
      isError: false,
    });

    render(<AppGrid animationsEnabled={false} />);

    expect(screen.getByText("No installed apps found.")).toBeTruthy();
  });
});
