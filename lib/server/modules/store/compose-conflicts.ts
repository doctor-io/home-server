import "server-only";

import yaml from "js-yaml";

export type ComposeConflictCode = "port_in_use" | "container_name_taken";

export type ComposeConflict = {
  code: ComposeConflictCode;
  service: string;
  value: string;
  detail: string;
};

export type InstalledStackSummary = {
  appId: string;
  stackName: string;
  webUiPort: number | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Host ports a service publishes. Compose accepts "8080:80", "127.0.0.1:8080:80",
 * "8080-8081:80-81" and the long object form; the host side is what collides.
 */
export function publishedHostPorts(service: Record<string, unknown>): number[] {
  const entries = Array.isArray(service.ports) ? service.ports : [];
  const ports: number[] = [];

  for (const entry of entries) {
    if (typeof entry === "number") {
      ports.push(entry);
      continue;
    }

    if (typeof entry === "string") {
      const parts = entry.split(":");
      // No host side ("80") means Docker assigns one — nothing to collide with.
      if (parts.length < 2) continue;

      const hostPart = parts[parts.length - 2];
      for (const port of expandRange(hostPart)) ports.push(port);
      continue;
    }

    const record = asRecord(entry);
    const published = record?.published;
    if (typeof published === "number") ports.push(published);
    else if (typeof published === "string") {
      for (const port of expandRange(published)) ports.push(port);
    }
  }

  return ports.filter((port) => Number.isInteger(port) && port > 0 && port < 65_536);
}

function expandRange(value: string): number[] {
  const trimmed = value.trim();
  if (!trimmed) return [];

  const [start, end] = trimmed.split("-").map((part) => Number.parseInt(part, 10));
  if (!Number.isInteger(start)) return [];
  if (!Number.isInteger(end)) return [start];

  // A range is bounded to keep a typo like "1-65535" from producing a
  // pathological list; anything that wide is a conflict with something anyway.
  const span = Math.min(end - start, 128);
  return Array.from({ length: span + 1 }, (_, index) => start + index);
}

/**
 * Everything that would make `docker compose up` fail, found before the queue
 * starts rather than surfacing as a subprocess error two minutes in.
 */
export function detectComposeConflicts(input: {
  composeContent: string;
  appId: string;
  installedStacks: InstalledStackSummary[];
  usedContainerNames?: string[];
}): ComposeConflict[] {
  let parsed: unknown;
  try {
    parsed = yaml.load(input.composeContent);
  } catch {
    // Validation owns malformed input; there is nothing to compare here.
    return [];
  }

  const services = asRecord(asRecord(parsed)?.services);
  if (!services) return [];

  const others = input.installedStacks.filter((stack) => stack.appId !== input.appId);
  const portOwners = new Map<number, string>();
  for (const stack of others) {
    if (stack.webUiPort !== null) portOwners.set(stack.webUiPort, stack.appId);
  }

  const takenNames = new Set(
    (input.usedContainerNames ?? []).map((name) => name.toLowerCase()),
  );
  const conflicts: ComposeConflict[] = [];
  const seenPorts = new Set<number>();

  for (const [serviceName, rawService] of Object.entries(services)) {
    const service = asRecord(rawService);
    if (!service) continue;

    for (const port of publishedHostPorts(service)) {
      const owner = portOwners.get(port);
      if (owner && !seenPorts.has(port)) {
        seenPorts.add(port);
        conflicts.push({
          code: "port_in_use",
          service: serviceName,
          value: String(port),
          detail: `Port ${port} is already published by "${owner}"`,
        });
      }
    }

    const containerName =
      typeof service.container_name === "string" ? service.container_name.trim() : "";
    if (containerName && takenNames.has(containerName.toLowerCase())) {
      conflicts.push({
        code: "container_name_taken",
        service: serviceName,
        value: containerName,
        detail: `A container named "${containerName}" already exists`,
      });
    }
  }

  return conflicts;
}
