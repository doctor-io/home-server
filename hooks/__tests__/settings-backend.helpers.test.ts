import { describe, expect, it } from "vitest";
import { createSettingsCapabilities } from "@/modules/settings/hooks/backend/capabilities";
import {
  formatBytes,
  formatGigabytes,
  formatUptime,
  mapContainerToViewModel,
} from "@/modules/settings/hooks/backend/formatters";

describe("settings backend helpers", () => {
  it("formats uptime and storage units for settings view models", () => {
    expect(formatUptime(90_061)).toBe("1 day, 1 hour");
    expect(formatGigabytes(5 * 1024 ** 3)).toBe("5.0 GB");
    expect(formatBytes(512 * 1024 * 1024)).toBe("512.0 MB");
    expect(formatBytes(null)).toBe("--");
  });

  it("maps docker stats into a stable settings container view model", () => {
    expect(
      mapContainerToViewModel({
        id: "container1234567890",
        name: "plex",
        state: "running",
        cpuPercent: 3.4,
        memoryUsed: 512 * 1024 * 1024,
        memoryLimit: 2 * 1024 * 1024 * 1024,
        memoryPercent: 25,
        networkRx: 1,
        networkTx: 2,
        blockRead: 3,
        blockWrite: 4,
      }),
    ).toEqual({
      id: "container1234567890",
      name: "plex",
      image: "id:container123",
      status: "running",
      ports: "--",
      cpu: "3.4%",
      memory: "512.0 MB",
    });
  });

  it("exposes explicit capability defaults for unsupported settings controls", () => {
    const capabilities = createSettingsCapabilities();

    expect(capabilities.general.hostname.disabled).toBe(false);
    expect(capabilities.network.gateway.disabled).toBe(true);
    expect(capabilities.docker.pruneImages.disabled).toBe(false);
    expect(capabilities.saveBySection.security).toBe(true);
    expect(capabilities.saveBySection.power).toBe(false);
  });
});
