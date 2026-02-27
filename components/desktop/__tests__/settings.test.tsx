/* @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AppearanceSettings } from "@/lib/desktop/appearance";

const mockUseSettingsBackend = vi.fn();

vi.mock("@/hooks/useSettingsBackend", () => ({
  useSettingsBackend: () => mockUseSettingsBackend(),
}));

import { SettingsPanel } from "@/components/desktop/settings";

const appearance: AppearanceSettings = {
  theme: "dark",
  wallpaper: "wallpaper-1.jpg",
  accentColor: "oklch(0.72 0.14 190)",
  iconSize: "medium",
  dockPosition: "bottom",
  fontSize: "default",
  animationsEnabled: true,
};

function createBackendMock() {
  return {
    general: {
      hostname: "home-node",
      platform: "linux",
      kernel: "v22.17.0",
      architecture: "--",
      uptime: "1 day, 2 hours",
      appVersion: "--",
      username: "ahmed",
      cpuSummary: "30% load",
      memorySummary: "2.0 GB / 8.0 GB",
      temperatureSummary: "44.5 C",
      processUptime: "2 hours",
      isLoading: false,
      unavailable: false,
      warning: null,
    },
    network: {
      connected: true,
      iface: "wlan0",
      ipv4: "192.168.1.20",
      ssid: "HomeNet",
      signalPercent: "78%",
      wifiCount: 2,
      topSsids: ["HomeNet", "GuestNet"],
      isLoading: false,
      unavailable: false,
      warning: null,
    },
    storage: {
      mountPath: "/DATA",
      totalBytes: 4 * 1024 * 1024 * 1024 * 1024,
      usedBytes: 1800 * 1024 * 1024 * 1024,
      availableBytes: 2200 * 1024 * 1024 * 1024,
      usedPercent: 45,
      summary: "1800.00 GB / 4096.00 GB",
      shares: [
        {
          id: "local-1",
          name: "Media",
          path: "/Shared/Media",
          source: "/Media",
          protocol: "SMB usershare",
          status: "Mounted",
        },
      ],
      localShareCount: 1,
      networkShareCount: 0,
      isLoading: false,
      unavailable: false,
      warning: null,
    },
    docker: {
      containers: [
        {
          id: "container1",
          name: "plex",
          image: "id:container1",
          status: "running" as const,
          ports: "--",
          cpu: "2.3%",
          memory: "512 MB",
        },
      ],
      total: 1,
      running: 1,
      images: "--",
      engineVersion: "--",
      composeVersion: "--",
      storageDriver: "--",
      cgroupDriver: "--",
      isLoading: false,
      unavailable: false,
      warning: null,
    },
    updates: {
      entries: [
        {
          id: "plex",
          name: "Plex",
          current: "111111111111",
          available: "222222222222",
          type: "app" as const,
        },
      ],
      availableCount: 1,
      isLoading: false,
      unavailable: false,
      warning: null,
      isChecking: false,
      checkError: null,
    },
    capabilities: {
      general: {
        hostname: { disabled: true, disabledReason: "Not available yet: backend endpoint not implemented" },
        timezone: { disabled: true, disabledReason: "Not available yet: backend endpoint not implemented" },
        language: { disabled: true, disabledReason: "Not available yet: backend endpoint not implemented" },
        autoStart: { disabled: true, disabledReason: "Not available yet: backend endpoint not implemented" },
        remoteAccess: { disabled: true, disabledReason: "Not available yet: backend endpoint not implemented" },
        telemetry: { disabled: true, disabledReason: "Not available yet: backend endpoint not implemented" },
      },
      network: {
        gateway: { disabled: true, disabledReason: "Not available yet: backend endpoint not implemented" },
        dnsPrimary: { disabled: true, disabledReason: "Not available yet: backend endpoint not implemented" },
        dnsSecondary: { disabled: true, disabledReason: "Not available yet: backend endpoint not implemented" },
        domain: { disabled: true, disabledReason: "Not available yet: backend endpoint not implemented" },
        dhcp: { disabled: true, disabledReason: "Not available yet: backend endpoint not implemented" },
        ipv6: { disabled: true, disabledReason: "Not available yet: backend endpoint not implemented" },
        wol: { disabled: true, disabledReason: "Not available yet: backend endpoint not implemented" },
        mtu: { disabled: true, disabledReason: "Not available yet: backend endpoint not implemented" },
        addRule: { disabled: true, disabledReason: "Not available yet: backend endpoint not implemented" },
      },
      docker: {
        lifecycle: { disabled: true, disabledReason: "Not available yet: backend endpoint not implemented" },
        autoRestart: { disabled: true, disabledReason: "Not available yet: backend endpoint not implemented" },
        logRotation: { disabled: true, disabledReason: "Not available yet: backend endpoint not implemented" },
        defaultNetwork: { disabled: true, disabledReason: "Not available yet: backend endpoint not implemented" },
        pruneImages: { disabled: true, disabledReason: "Not available yet: backend endpoint not implemented" },
        pruneVolumes: { disabled: true, disabledReason: "Not available yet: backend endpoint not implemented" },
      },
      updates: {
        updateRow: { disabled: true, disabledReason: "Not available yet: backend endpoint not implemented" },
        updateAll: { disabled: true, disabledReason: "Not available yet: backend endpoint not implemented" },
        autoCheck: { disabled: true, disabledReason: "Not available yet: backend endpoint not implemented" },
        channel: { disabled: true, disabledReason: "Not available yet: backend endpoint not implemented" },
        autoUpdatePolicy: { disabled: true, disabledReason: "Not available yet: backend endpoint not implemented" },
        checkForUpdates: { disabled: false, disabledReason: undefined },
      },
      unsupportedSectionReason: "Not available yet: backend endpoint not implemented",
      saveBySection: {
        general: false,
        network: false,
        storage: false,
        docker: false,
        users: false,
        security: false,
        notifications: false,
        backup: false,
        updates: false,
        power: false,
      },
      saveDisabledReason: "Not available in this pass: no save endpoint",
    },
    actions: {
      checkForUpdates: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe("SettingsPanel", () => {
  beforeEach(() => {
    mockUseSettingsBackend.mockReturnValue(createBackendMock());
  });

  it("renders General with backend hostname and uptime", () => {
    render(
      <SettingsPanel
        appearance={appearance}
        wallpaperOptions={[]}
        accentOptions={[]}
        onAppearanceChange={() => {}}
      />,
    );

    expect(screen.getAllByText("home-node").length).toBeGreaterThan(0);
    expect(screen.getByText("1 day, 2 hours")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Toggle Auto-start services on boot",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("renders Network disconnected state", () => {
    const backend = createBackendMock();
    backend.network.connected = false;
    backend.network.signalPercent = "--";
    backend.network.ssid = "--";
    mockUseSettingsBackend.mockReturnValue(backend);

    render(
      <SettingsPanel
        appearance={appearance}
        wallpaperOptions={[]}
        accentOptions={[]}
        onAppearanceChange={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Network/i }));

    expect(screen.getByText("Disconnected")).toBeTruthy();
    expect(screen.getByText("Signal --")).toBeTruthy();
  });

  it("renders Docker rows and disables lifecycle buttons", () => {
    render(
      <SettingsPanel
        appearance={appearance}
        wallpaperOptions={[]}
        accentOptions={[]}
        onAppearanceChange={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Docker/i }));

    expect(screen.getByText("plex")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Stop" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Restart" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("triggers check for updates action", () => {
    const backend = createBackendMock();
    mockUseSettingsBackend.mockReturnValue(backend);

    render(
      <SettingsPanel
        appearance={appearance}
        wallpaperOptions={[]}
        accentOptions={[]}
        onAppearanceChange={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Updates/i }));
    fireEvent.click(screen.getByRole("button", { name: "Check for Updates" }));

    expect(backend.actions.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(
      (screen.getByRole("button", { name: "Update" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("disables unsupported section controls with reason", () => {
    render(
      <SettingsPanel
        appearance={appearance}
        wallpaperOptions={[]}
        accentOptions={[]}
        onAppearanceChange={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Users & Access/i }));

    expect(
      screen.getAllByText("Not available yet: backend endpoint not implemented")
        .length,
    ).toBeGreaterThan(0);
    const addUserButton = screen.getByRole("button", {
      name: "+ Add User",
    }) as HTMLButtonElement;
    expect(addUserButton.closest("fieldset")?.hasAttribute("disabled")).toBe(
      true,
    );
  });
});
