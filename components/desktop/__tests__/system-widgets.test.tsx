/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { Cpu, MemoryStick, Thermometer } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import type { SystemWidgetsViewModel } from "@/components/desktop/system-widgets/types";

const mockUseSystemWidgetsData = vi.fn<SystemWidgetsViewModel, []>();

vi.mock("@/components/desktop/system-widgets/use-system-widgets-data", () => ({
  useSystemWidgetsData: () => mockUseSystemWidgetsData(),
}));

import { SystemWidgets } from "@/components/desktop/system-widgets";

describe("SystemWidgets", () => {
  it("renders sections and values from backend view model", () => {
    mockUseSystemWidgetsData.mockReturnValue({
      uptime: { days: 1, hours: 4, minutes: 28 },
      resources: [
        {
          label: "CPU",
          value: "51%",
          progress: 51,
          colorClassName: "bg-primary",
          icon: Cpu,
        },
        {
          label: "Memory",
          value: "4.2 / 8.0 GB",
          progress: 52,
          colorClassName: "bg-chart-2",
          icon: MemoryStick,
        },
        {
          label: "Temperature",
          value: "46 C",
          progress: 46,
          colorClassName: "bg-status-amber",
          icon: Thermometer,
        },
      ],
      network: {
        downloadText: "24.8 Mbps",
        uploadText: "8.3 Mbps",
        ipAddress: "192.168.1.30",
        hostname: "pi4-home",
        interfaceName: "wlan0",
        ssid: "HomeNet",
      },
      quickStats: [
        { label: "Running", value: "7", sub: "apps" },
        { label: "Installed", value: "11", sub: "apps" },
        { label: "Networks", value: "4", sub: "nearby" },
        { label: "Weather", value: "21°", sub: "Tunis, Tunisia" },
      ],
    });

    render(<SystemWidgets />);

    expect(screen.getByText("Uptime")).toBeTruthy();
    expect(screen.getByText("Resources")).toBeTruthy();
    expect(screen.getByText("Network")).toBeTruthy();
    expect(screen.getByText("4.2 / 8.0 GB")).toBeTruthy();
    expect(screen.getByText("192.168.1.30")).toBeTruthy();
    expect(screen.getByText("21°")).toBeTruthy();
  });
});
