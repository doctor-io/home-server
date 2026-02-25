/**
 * Format bytes to human-readable string
 */
export function formatBytes(
  bytes: number,
  decimals = 2,
): { value: string; unit: string } {
  if (bytes === 0) return { value: "0", unit: "Bytes" };

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = (bytes / Math.pow(k, i)).toFixed(dm);

  return {
    value,
    unit: sizes[i] || "Bytes",
  };
}

/**
 * Format bytes to string with unit
 */
export function formatBytesCompact(bytes: number, decimals = 2): string {
  const { value, unit } = formatBytes(bytes, decimals);
  return `${value} ${unit}`;
}

/**
 * Convert seconds to human-readable uptime
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

  return parts.join(" ");
}

/**
 * Format uptime in short format (e.g., "2d 5h")
 */
export function formatUptimeShort(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m`;
}

/**
 * Format percentage to fixed decimals
 */
export function formatPercent(value: number | undefined | null, decimals = 1): string {
  if (value == null || !Number.isFinite(value)) return "--";
  return value.toFixed(decimals);
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Format number with thousand separators
 */
export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Get status color class based on percentage threshold
 */
export function getStatusColor(
  percent: number,
  thresholds = { warning: 70, critical: 90 },
): string {
  if (percent >= thresholds.critical) return "text-status-red";
  if (percent >= thresholds.warning) return "text-status-amber";
  return "text-status-green";
}

/**
 * Get progress bar color based on percentage threshold
 */
export function getProgressColor(
  percent: number,
  thresholds = { warning: 70, critical: 90 },
): string {
  if (percent >= thresholds.critical) return "bg-status-red";
  if (percent >= thresholds.warning) return "bg-status-amber";
  return "bg-status-green";
}
