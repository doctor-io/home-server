import "server-only";

import yaml from "js-yaml";
import { logServerAction } from "@/lib/server/logging/logger";

export type ParsedComposeService = {
  image?: string;
  ports?: string[];
  environment?: Record<string, string>;
  volumes?: string[];
  networkMode?: string;
  restart?: string;
  privileged?: boolean;
  capAdd?: string[];
  hostname?: string;
  devices?: string[];
  command?: string | string[];
};

export type ParsedComposeFile = {
  services: Record<string, ParsedComposeService>;
};

export type PrimaryComposeService = {
  name: string;
  service: ParsedComposeService;
};

const INFRA_SERVICE_TOKEN_PATTERN =
  /(?:^|[-_.])(db|database|postgres|postgresql|mariadb|mysql|redis|cache|broker|queue|rabbitmq|kafka|zookeeper|mongo|mongodb|elasticsearch|minio)(?:$|[-_.])/i;
const APP_ALIAS_PATTERN = /^(app|main|server|web|frontend|backend)$/i;

function hasPublishedPorts(service: ParsedComposeService): boolean {
  return Array.isArray(service.ports) && service.ports.length > 0;
}

function scorePrimaryServiceCandidate(input: {
  name: string;
  service: ParsedComposeService;
  appId?: string;
}): number {
  const name = input.name.toLowerCase();
  const appId = input.appId?.toLowerCase().trim();
  const image = typeof input.service.image === "string" ? input.service.image.toLowerCase() : "";

  let score = 0;
  if (hasPublishedPorts(input.service)) {
    score += 40;
  }

  if (name === "app") {
    score += 60;
  } else if (APP_ALIAS_PATTERN.test(name)) {
    score += 30;
  }
  if (name.includes("server")) {
    score += 20;
  }

  if (appId) {
    if (name === appId) {
      score += 100;
    } else if (name.startsWith(`${appId}-`) || name.endsWith(`-${appId}`)) {
      score += 45;
    } else if (name.includes(appId)) {
      score += 25;
    }

    if (image.includes(appId)) {
      score += 20;
    }
  }

  if (INFRA_SERVICE_TOKEN_PATTERN.test(name)) {
    score -= 80;
  }

  return score;
}

/**
 * Fetch docker-compose.yml from a GitHub repository
 */
export async function fetchComposeFileFromGitHub(input: {
  repositoryUrl: string;
  stackFile: string;
}): Promise<string | null> {
  try {
    // Convert GitHub repository URL to raw content URL
    // Example: https://github.com/bigbeartechworld/big-bear-portainer
    // -> https://raw.githubusercontent.com/bigbeartechworld/big-bear-portainer/main/...

    const repoUrl = input.repositoryUrl.replace("https://github.com/", "");
    const rawUrl = `https://raw.githubusercontent.com/${repoUrl}/main/${input.stackFile}`;

    const response = await fetch(rawUrl, {
      headers: {
        "User-Agent": "home-server/1.0",
      },
    });

    if (!response.ok) {
      logServerAction({
        level: "warn",
        layer: "service",
        action: "store.compose.fetch",
        status: "error",
        message: `Failed to fetch compose file: ${response.status}`,
        meta: {
          url: rawUrl,
        },
      });
      return null;
    }

    return await response.text();
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "service",
      action: "store.compose.fetch",
      status: "error",
      message: "Failed to fetch compose file",
      error,
    });
    return null;
  }
}

/**
 * Parse docker-compose YAML content
 */
export function parseComposeFile(content: string): ParsedComposeFile | null {
  try {
    const parsed = yaml.load(content) as any;

    if (!parsed || typeof parsed !== "object" || !parsed.services) {
      return null;
    }

    const services: Record<string, ParsedComposeService> = {};

    for (const [serviceName, serviceConfig] of Object.entries(parsed.services || {})) {
      const config = serviceConfig as any;

      // Parse ports
      const ports: string[] = [];
      if (Array.isArray(config.ports)) {
        for (const port of config.ports) {
          if (typeof port === "string") {
            ports.push(port);
          } else if (typeof port === "object" && port.target) {
            ports.push(`${port.published || port.target}:${port.target}`);
          }
        }
      }

      // Parse environment
      const environment: Record<string, string> = {};
      if (Array.isArray(config.environment)) {
        for (const env of config.environment) {
          if (typeof env === "string") {
            const [key, ...valueParts] = env.split("=");
            if (key) {
              environment[key] = valueParts.join("=") || "";
            }
          }
        }
      } else if (config.environment && typeof config.environment === "object") {
        Object.assign(environment, config.environment);
      }

      // Parse volumes
      const volumes: string[] = [];
      if (Array.isArray(config.volumes)) {
        for (const volume of config.volumes) {
          if (typeof volume === "string") {
            volumes.push(volume);
          } else if (typeof volume === "object" && volume.source && volume.target) {
            volumes.push(`${volume.source}:${volume.target}`);
          }
        }
      }

      // Parse cap_add
      const capAdd: string[] = [];
      if (Array.isArray(config.cap_add)) {
        capAdd.push(...config.cap_add.filter((c: any) => typeof c === "string"));
      }

      // Parse devices
      const devices: string[] = [];
      if (Array.isArray(config.devices)) {
        devices.push(...config.devices.filter((d: any) => typeof d === "string"));
      }

      services[serviceName] = {
        image: config.image,
        ports,
        environment,
        volumes,
        networkMode: config.network_mode || config.networkMode,
        restart: config.restart,
        privileged: Boolean(config.privileged),
        capAdd,
        hostname: config.hostname,
        devices,
        command: config.command,
      };
    }

    return { services };
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "service",
      action: "store.compose.parse",
      status: "error",
      message: "Failed to parse compose file",
      error,
    });
    return null;
  }
}

/**
 * Extract the primary service from a parsed compose file
 * (usually the first service, or the one matching the app name)
 */
export function extractPrimaryServiceWithName(
  parsed: ParsedComposeFile,
  appId?: string,
): PrimaryComposeService | null {
  const serviceNames = Object.keys(parsed.services);

  if (serviceNames.length === 0) {
    return null;
  }

  // First prefer an exact service-name match.
  if (appId) {
    const normalizedAppId = appId.toLowerCase().trim();
    const exactMatch = serviceNames.find((name) => name.toLowerCase() === normalizedAppId);
    if (exactMatch) {
      return {
        name: exactMatch,
        service: parsed.services[exactMatch],
      };
    }
  }

  const rankedServices = serviceNames
    .map((name, index) => ({
      name,
      index,
      score: scorePrimaryServiceCandidate({
        name,
        service: parsed.services[name],
        appId,
      }),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const fallbackName = rankedServices[0]?.name ?? serviceNames[0];
  return {
    name: fallbackName,
    service: parsed.services[fallbackName],
  };
}

export function extractPrimaryService(
  parsed: ParsedComposeFile,
  appId?: string,
): ParsedComposeService | null {
  return extractPrimaryServiceWithName(parsed, appId)?.service ?? null;
}

/**
 * Fetch and parse docker-compose.yml from GitHub repository
 */
export async function fetchAndParseCompose(input: {
  repositoryUrl: string;
  stackFile: string;
  appId?: string;
}): Promise<ParsedComposeService | null> {
  const content = await fetchComposeFileFromGitHub({
    repositoryUrl: input.repositoryUrl,
    stackFile: input.stackFile,
  });

  if (!content) {
    return null;
  }

  const parsed = parseComposeFile(content);

  if (!parsed) {
    return null;
  }

  return extractPrimaryService(parsed, input.appId);
}
