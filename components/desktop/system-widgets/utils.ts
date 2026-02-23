import type { UptimeParts } from "@/components/desktop/system-widgets/types";

export function clampPercent(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(Math.round(value), 100));
}

export function formatGigabytes(valueInBytes: number | null | undefined) {
  if (typeof valueInBytes !== "number" || Number.isNaN(valueInBytes)) {
    return "--";
  }

  const bytesInGigabyte = 1024 ** 3;
  return (valueInBytes / bytesInGigabyte).toFixed(1);
}

export function formatMemoryValue(
  usedBytes: number | null | undefined,
  totalBytes: number | null | undefined,
) {
  const used = formatGigabytes(usedBytes);
  const total = formatGigabytes(totalBytes);

  if (used === "--" || total === "--") return "--";
  return `${used} / ${total} GB`;
}

export function formatTemperatureValue(celsius: number | null | undefined) {
  if (typeof celsius !== "number" || Number.isNaN(celsius)) return "--";
  return `${Math.round(celsius)} C`;
}

export function formatRateMbps(mbps: number | null | undefined) {
  if (typeof mbps !== "number" || Number.isNaN(mbps)) return "--";
  return `${mbps.toFixed(1)} Mbps`;
}

export function toUptimeParts(uptimeSeconds: number | null | undefined): UptimeParts {
  const totalSeconds =
    typeof uptimeSeconds === "number" && Number.isFinite(uptimeSeconds)
      ? Math.max(Math.floor(uptimeSeconds), 0)
      : 0;

  const totalMinutes = Math.floor(totalSeconds / 60);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  return {
    days,
    hours,
    minutes,
  };
}

export function formatWeatherValue(celsius: number | null | undefined) {
  if (typeof celsius !== "number" || Number.isNaN(celsius)) return "--";
  return `${Math.round(celsius)}°`;
}
