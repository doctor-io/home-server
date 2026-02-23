import "server-only";

import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { serverEnv } from "@/lib/server/env";
import { withServerTiming } from "@/lib/server/logging/logger";

const execFileAsync = promisify(execFile);

type ComposeCommandInput = {
  composePath: string;
  envPath: string;
  stackName: string;
  args: string[];
};

export type MaterializedStack = {
  stackDir: string;
  composePath: string;
  envPath: string;
  stackName: string;
  webUiPort: number | null;
};

function sanitizeSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function sanitizeStackName(appId: string, displayName?: string) {
  const source = displayName && displayName.trim().length > 0 ? displayName : appId;
  const sanitized = sanitizeSegment(source);

  if (!sanitized) {
    return `app-${Date.now()}`;
  }

  return sanitized.slice(0, 63);
}

export function buildRawStackFileUrl(repositoryUrl: string, stackFile: string) {
  const parsed = new URL(repositoryUrl);
  if (parsed.hostname !== "github.com") {
    throw new Error(`Unsupported repository URL: ${repositoryUrl}`);
  }

  const [owner, repoRaw] = parsed.pathname.split("/").filter(Boolean);
  if (!owner || !repoRaw) {
    throw new Error(`Invalid repository URL: ${repositoryUrl}`);
  }

  const repo = repoRaw.endsWith(".git") ? repoRaw.slice(0, -4) : repoRaw;
  return `https://raw.githubusercontent.com/${owner}/${repo}/main/${stackFile}`;
}

function serializeEnvFile(env: Record<string, string>) {
  return Object.keys(env)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => `${key}=${env[key] ?? ""}`)
    .join("\n");
}

export function applyWebUiPortOverride(composeContent: string, webUiPort: number) {
  const lines = composeContent.split("\n");
  let replaced = false;

  const updated = lines.map((line) => {
    if (replaced) return line;

    const match = line.match(/^(\s*-\s*["']?)(\d+)(:\d+(?::\d+)?(?:\/[a-z]+)?["']?\s*)$/i);
    if (!match) return line;

    replaced = true;
    return `${match[1]}${webUiPort}${match[3]}`;
  });

  if (!replaced) {
    throw new Error("Unable to override web UI port: no numeric published port mapping found");
  }

  return updated.join("\n");
}

export async function materializeStackFiles(input: {
  appId: string;
  stackName: string;
  repositoryUrl: string;
  stackFile: string;
  env: Record<string, string>;
  webUiPort: number | null;
}) {
  const rawUrl = buildRawStackFileUrl(input.repositoryUrl, input.stackFile);
  const response = await fetch(rawUrl, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch stack file (${response.status}) from ${rawUrl}`);
  }

  let composeContent = await response.text();
  if (input.webUiPort !== null) {
    composeContent = applyWebUiPortOverride(composeContent, input.webUiPort);
  }

  const stackDir = path.resolve(process.cwd(), serverEnv.STORE_STACKS_ROOT, input.appId);
  const composePath = path.join(stackDir, "docker-compose.yml");
  const envPath = path.join(stackDir, ".env");

  await mkdir(stackDir, { recursive: true });
  await writeFile(composePath, composeContent, "utf8");
  await writeFile(envPath, serializeEnvFile(input.env), "utf8");

  return {
    stackDir,
    composePath,
    envPath,
    stackName: input.stackName,
    webUiPort: input.webUiPort,
  } satisfies MaterializedStack;
}

export async function materializeInlineStackFiles(input: {
  appId: string;
  stackName: string;
  composeContent: string;
  env: Record<string, string>;
  webUiPort: number | null;
}) {
  let composeContent = input.composeContent
  if (input.webUiPort !== null) {
    composeContent = applyWebUiPortOverride(composeContent, input.webUiPort)
  }

  const stackDir = path.resolve(process.cwd(), serverEnv.STORE_STACKS_ROOT, input.appId)
  const composePath = path.join(stackDir, "docker-compose.yml")
  const envPath = path.join(stackDir, ".env")

  await mkdir(stackDir, { recursive: true })
  await writeFile(composePath, composeContent, "utf8")
  await writeFile(envPath, serializeEnvFile(input.env), "utf8")

  return {
    stackDir,
    composePath,
    envPath,
    stackName: input.stackName,
    webUiPort: input.webUiPort,
  } satisfies MaterializedStack
}

async function runComposeCommand(input: ComposeCommandInput) {
  return withServerTiming(
    {
      layer: "system",
      action: "store.compose.exec",
      meta: {
        stackName: input.stackName,
        args: input.args,
      },
    },
    async () => {
      const args = [
        "compose",
        "-f",
        input.composePath,
        "--env-file",
        input.envPath,
        "-p",
        input.stackName,
        ...input.args,
      ];

      const { stdout } = await execFileAsync("docker", args, {
        cwd: path.dirname(input.composePath),
      });

      return stdout;
    },
  );
}

export async function extractComposeImages(input: {
  composePath: string;
  envPath: string;
  stackName: string;
}) {
  const stdout = await runComposeCommand({
    ...input,
    args: ["config", "--images"],
  });

  return Array.from(
    new Set(
      stdout
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    ),
  );
}

export async function runComposeUp(input: {
  composePath: string;
  envPath: string;
  stackName: string;
}) {
  await runComposeCommand({
    ...input,
    args: ["up", "-d"],
  });
}

export async function runComposeDown(input: {
  composePath: string;
  envPath: string;
  stackName: string;
  removeVolumes?: boolean;
}) {
  const args = ["down"];
  if (input.removeVolumes) {
    args.push("-v");
  }

  await runComposeCommand({
    ...input,
    args,
  });
}
