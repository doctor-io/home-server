import { describe, expect, it, vi } from "vitest";

vi.mock("node:os", () => ({
  default: {
    loadavg: () => [0.6, 0.5, 0.4],
    cpus: () => [{}, {}, {}],
    totalmem: () => 1024,
    freemem: () => 256,
    hostname: () => "pi",
    platform: () => "linux",
    release: () => "6.6",
    uptime: () => 3600,
  },
}));

vi.mock("systeminformation", () => ({
  default: {
    currentLoad: vi.fn(async () => ({
      currentLoad: 33.3,
    })),
    cpuTemperature: vi.fn(async () => ({
      main: 49.2,
      cores: [48.5, 51.1],
      max: 51.1,
    })),
    battery: vi.fn(async () => ({
      hasBattery: true,
      isCharging: false,
      percent: 78,
      timeRemaining: 98,
      acConnected: false,
      manufacturer: "SONY",
      cycleCount: 248,
      designedCapacity: 50,
      maxCapacity: 45,
    })),
    wifiConnections: vi.fn(async () => [
      {
        iface: "wlan0",
        ssid: "HomeNet",
        bssid: "11:22:33",
        quality: 66,
        txRate: 130,
      },
    ]),
    wifiNetworks: vi.fn(async () => [
      {
        ssid: "HomeNet",
        channel: 1,
        quality: 66,
        security: ["WPA2"],
        rsnFlags: [],
      },
    ]),
    networkInterfaces: vi.fn(async () => [
      {
        iface: "wlan0",
        default: true,
        ip4: "192.168.1.22",
        ip6: "fe80::1234",
      },
    ]),
    networkStats: vi.fn(async () => [
      {
        iface: "wlan0",
        operstate: "up",
        rx_bytes: 1000,
        rx_dropped: 0,
        rx_errors: 0,
        tx_bytes: 1000,
        tx_dropped: 0,
        tx_errors: 0,
        rx_sec: 3_100_000,
        tx_sec: 1_100_000,
        ms: 1000,
      },
    ]),
    fsSize: vi.fn(async () => [
      {
        fs: "/dev/sda1",
        type: "ext4",
        size: 500 * 1024 * 1024 * 1024,
        used: 120 * 1024 * 1024 * 1024,
        use: 24,
        mount: "/",
      },
    ]),
    diskLayout: vi.fn(async () => [
      {
        device: "/dev/sda",
        type: "SSD",
        smartStatus: "Ok",
      },
    ]),
  },
}));

import { getSystemMetricsSnapshot } from "@/lib/server/modules/system/service";

describe("system service", () => {
  it("returns a snapshot with expected shape", async () => {
    const snapshot = await getSystemMetricsSnapshot({ bypassCache: true });

    expect(snapshot.hostname).toBe("pi");
    expect(snapshot.timestamp).toBeTypeOf("string");
    expect(snapshot.uptimeSeconds).toBe(3600);
    expect(snapshot.cpu.normalizedPercent).toBeGreaterThanOrEqual(0);
    expect(snapshot.cpu.normalizedPercent).toBeLessThanOrEqual(100);
    expect(snapshot.memory.totalBytes).toBe(1024);
    expect(snapshot.temperature.mainCelsius).toBe(49.2);
    expect(snapshot.battery.percent).toBe(78);
    expect(snapshot.battery.manufacturer).toBe("SONY");
    expect(snapshot.battery.cycleCount).toBe(248);
    expect(snapshot.battery.designToMaxCapacityPercent).toBe(90);
    expect(snapshot.wifi.connected).toBe(true);
    expect(snapshot.wifi.ssid).toBe("HomeNet");
    expect(snapshot.wifi.downloadMbps).toBe(24.8);
    expect(snapshot.wifi.uploadMbps).toBe(8.8);
  });

  it("serves cached snapshot unless bypassCache is set", async () => {
    const cachedOne = await getSystemMetricsSnapshot();
    const cachedTwo = await getSystemMetricsSnapshot();
    const fresh = await getSystemMetricsSnapshot({ bypassCache: true });

    expect(cachedTwo).toBe(cachedOne);
    expect(fresh).not.toBe(cachedOne);
  });
});
