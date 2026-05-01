import "server-only";

import { logServerAction } from "@/lib/server/logging/logger";
import type { ServerHardwareInfo } from "@/lib/shared/contracts/server-info";
import os from "node:os";
import si from "systeminformation";

const CACHE_TTL_MS = 5 * 60 * 1_000;

let cache: { value: ServerHardwareInfo; expiresAt: number } | null = null;

function toStr(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s.length > 0 && s !== "Default string" && s !== "To Be Filled By O.A.M.E." ? s : null;
}

function toNum(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

async function probe<T>(action: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logServerAction({ level: "warn", layer: "service", action, status: "error", error, message: "probe failed" });
    return fallback;
  }
}

async function collect(): Promise<ServerHardwareInfo> {
  const [cpuData, graphics, memLayout, osInfo, systemInfo, biosInfo, baseboardInfo, batteryData, networkIfaces] =
    await Promise.all([
      probe("server-info.cpu", () => si.cpu(), null),
      probe("server-info.graphics", () => si.graphics(), { controllers: [], displays: [] }),
      probe("server-info.memLayout", () => si.memLayout(), []),
      probe("server-info.osInfo", () => si.osInfo(), null),
      probe("server-info.system", () => si.system(), null),
      probe("server-info.bios", () => si.bios(), null),
      probe("server-info.baseboard", () => si.baseboard(), null),
      probe("server-info.battery", () => si.battery(), null),
      probe("server-info.networkInterfaces", () => si.networkInterfaces(), []),
    ]);

  return {
    fetchedAt: new Date().toISOString(),
    os: {
      platform: toStr(osInfo?.platform) ?? os.platform(),
      distro: toStr(osInfo?.distro),
      release: toStr(osInfo?.release),
      kernel: toStr(osInfo?.kernel),
      arch: toStr(osInfo?.arch) ?? os.arch(),
      codename: toStr(osInfo?.codename),
      hostname: os.hostname(),
    },
    system: {
      manufacturer: toStr(systemInfo?.manufacturer),
      model: toStr(systemInfo?.model),
      version: toStr(systemInfo?.version),
      serial: toStr(systemInfo?.serial),
      uuid: toStr(systemInfo?.uuid),
      sku: toStr(systemInfo?.sku),
    },
    bios: {
      vendor: toStr(biosInfo?.vendor),
      version: toStr(biosInfo?.version),
      releaseDate: toStr(biosInfo?.releaseDate),
      revision: toStr(biosInfo?.revision),
    },
    baseboard: {
      manufacturer: toStr(baseboardInfo?.manufacturer),
      model: toStr(baseboardInfo?.model),
      version: toStr(baseboardInfo?.version),
    },
    cpu: {
      manufacturer: toStr(cpuData?.manufacturer),
      brand: toStr(cpuData?.brand),
      speedGhz: toNum(cpuData?.speed),
      maxSpeedGhz: toNum(cpuData?.speedMax),
      cores: typeof cpuData?.cores === "number" && cpuData.cores > 0 ? cpuData.cores : os.cpus().length,
      physicalCores: typeof cpuData?.physicalCores === "number" && cpuData.physicalCores > 0 ? cpuData.physicalCores : null,
      processors: typeof cpuData?.processors === "number" && cpuData.processors > 0 ? cpuData.processors : null,
      socket: toStr(cpuData?.socket),
      governor: toStr(cpuData?.governor),
    },
    memory: {
      totalBytes: os.totalmem(),
      slots: memLayout.map((slot) => ({
        bank: toStr(slot.bank),
        type: toStr(slot.type),
        formFactor: toStr(slot.formFactor),
        sizeBytes: typeof slot.size === "number" && slot.size > 0 ? slot.size : null,
        clockSpeedMhz: typeof slot.clockSpeed === "number" && slot.clockSpeed > 0 ? slot.clockSpeed : null,
        manufacturer: toStr(slot.manufacturer),
      })),
    },
    gpu: {
      controllers: graphics.controllers.map((ctrl) => ({
        vendor: toStr(ctrl.vendor),
        model: toStr(ctrl.model),
        bus: toStr(ctrl.bus),
        vramBytes: typeof ctrl.vram === "number" && ctrl.vram > 0 ? ctrl.vram * 1_048_576 : null,
        subVendor: toStr(ctrl.subVendor),
      })),
    },
    battery: {
      hasBattery: Boolean(batteryData?.hasBattery),
      manufacturer: batteryData?.hasBattery ? toStr(batteryData?.manufacturer) : null,
      maxCapacityWh: batteryData?.hasBattery && typeof batteryData.maxCapacity === "number" && batteryData.maxCapacity > 0
        ? Number(batteryData.maxCapacity.toFixed(1)) : null,
      designedCapacityWh: batteryData?.hasBattery && typeof batteryData.designedCapacity === "number" && batteryData.designedCapacity > 0
        ? Number(batteryData.designedCapacity.toFixed(1)) : null,
      cycleCount: batteryData?.hasBattery && typeof batteryData.cycleCount === "number" && batteryData.cycleCount >= 0
        ? Math.round(batteryData.cycleCount) : null,
    },
    network: {
      interfaces: (Array.isArray(networkIfaces) ? networkIfaces : [])
        .filter((iface) => !iface.internal && !iface.virtual && iface.iface)
        .map((iface) => ({
          iface: iface.iface,
          type: toStr(iface.type),
          operstate: iface.operstate === "up" || iface.operstate === "down" ? iface.operstate : null,
          ip4: toStr(iface.ip4),
          ip4subnet: toStr(iface.ip4subnet),
          ip6: toStr(iface.ip6),
          mac: toStr(iface.mac),
          speedMbps: typeof iface.speed === "number" && iface.speed > 0 ? iface.speed : null,
          duplex: toStr(iface.duplex),
          dhcp: Boolean(iface.dhcp),
          isDefault: Boolean(iface.default),
        })),
    },
  };
}

export async function getServerHardwareInfo(): Promise<ServerHardwareInfo> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const value = await collect();
  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}
