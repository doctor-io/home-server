/* @vitest-environment jsdom */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WifiPopover } from "@/components/desktop/status-bar/wifi-popover";

const mockUseWifiNetworks = vi.fn();
const mockUseNetworkActions = vi.fn();

vi.mock("@/hooks/useWifiNetworks", () => ({
  useWifiNetworks: () => mockUseWifiNetworks(),
}));

vi.mock("@/hooks/useNetworkActions", () => ({
  useNetworkActions: () => mockUseNetworkActions(),
}));

describe("WifiPopover", () => {
  it("calls connect/disconnect actions from UI controls", async () => {
    const connectNetwork = vi.fn().mockResolvedValue(undefined);
    const disconnectNetwork = vi.fn().mockResolvedValue(undefined);
    mockUseWifiNetworks.mockReturnValue({
      data: [
        {
          ssid: "GuestNet",
          bssid: "11:22:33",
          signalPercent: 42,
          channel: 11,
          frequencyMhz: 2462,
          security: null,
        },
      ],
    });
    mockUseNetworkActions.mockReturnValue({
      connectNetwork,
      disconnectNetwork,
      isConnecting: false,
      isDisconnecting: false,
      actionError: null,
    });

    render(
      <WifiPopover
        metrics={{
          timestamp: "2026-02-23T00:00:00.000Z",
          hostname: "homeio",
          platform: "linux",
          uptimeSeconds: 10,
          cpu: {
            oneMinute: 0,
            fiveMinute: 0,
            fifteenMinute: 0,
            normalizedPercent: 0,
          },
          memory: {
            totalBytes: 1,
            freeBytes: 1,
            usedBytes: 0,
            usedPercent: 0,
          },
          temperature: {
            mainCelsius: null,
            maxCelsius: null,
            coresCelsius: [],
          },
          battery: {
            hasBattery: false,
            isCharging: false,
            percent: null,
            timeRemainingMinutes: null,
            acConnected: null,
            manufacturer: null,
            cycleCount: null,
            designedCapacityWh: null,
            maxCapacityWh: null,
            designToMaxCapacityPercent: null,
          },
          wifi: {
            connected: true,
            iface: "wlan0",
            ssid: "HomeNet",
            bssid: null,
            signalPercent: 70,
            txRateMbps: null,
            downloadMbps: 4,
            uploadMbps: 1,
            ipv4: "192.168.1.12",
            ipv6: null,
            availableNetworks: [],
          },
          process: {
            pid: 1,
            uptimeSeconds: 1,
            nodeVersion: "v22",
          },
        }}
        networkStatus={{
          connected: true,
          iface: "wlan0",
          ssid: "HomeNet",
          ipv4: "192.168.1.12",
          signalPercent: 70,
        }}
        onClose={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(disconnectNetwork).toHaveBeenCalledWith({
      iface: "wlan0",
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    });
    expect(connectNetwork).toHaveBeenCalledWith({
      ssid: "GuestNet",
      password: undefined,
    });
  });
});
