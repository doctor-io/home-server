import "server-only";

import { serverEnv } from "@/lib/server/env";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const DATA_SUBDIRECTORIES = [
  "Apps",
  "Documents",
  "Media",
  "Download",
  "Network",
  ".Trash",
] as const;

let resolvedDataRoot: string | null = null;

function resolveConfiguredPath(inputPath: string) {
  return path.isAbsolute(inputPath)
    ? inputPath
    : path.resolve(process.cwd(), inputPath);
}

function resolvePrimaryDataRoot() {
  return path.dirname(resolveConfiguredPath(serverEnv.STORE_STACKS_ROOT));
}

export function resolveStoreStacksRoot() {
  // If we've already resolved a fallback, use it
  if (resolvedDataRoot) {
    return path.join(resolvedDataRoot, "Apps");
  }

  return resolveConfiguredPath(serverEnv.STORE_STACKS_ROOT);
}

export function resolveStoreAppDataRoot() {
  const configured = resolveConfiguredPath(serverEnv.STORE_APP_DATA_ROOT);
  if (!resolvedDataRoot) {
    return configured;
  }

  const primaryDataRoot = resolvePrimaryDataRoot();
  if (resolvedDataRoot === primaryDataRoot) {
    return configured;
  }

  return path.join(resolvedDataRoot, "Apps");
}

export function resolveDataRootDirectory() {
  if (resolvedDataRoot) {
    return resolvedDataRoot;
  }
  return path.dirname(resolveStoreStacksRoot());
}

export async function ensureDataRootDirectories() {
  const primaryDataRoot = resolvePrimaryDataRoot();
  const fallbackDataRoot = path.resolve(process.cwd(), "DATA");

  let dataRoot = primaryDataRoot;

  try {
    await Promise.all(
      DATA_SUBDIRECTORIES.map((name) =>
        mkdir(path.join(primaryDataRoot, name), { recursive: true }),
      ),
    );
    resolvedDataRoot = primaryDataRoot;
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "unknown error";
    console.warn(
      `[Storage] Cannot create directories at ${primaryDataRoot} (${errorMessage}). Falling back to ${fallbackDataRoot}`,
    );

    await Promise.all(
      DATA_SUBDIRECTORIES.map((name) =>
        mkdir(path.join(fallbackDataRoot, name), { recursive: true }),
      ),
    );

    dataRoot = fallbackDataRoot;
    resolvedDataRoot = fallbackDataRoot;
  }

  return {
    dataRoot,
    subdirectories: [...DATA_SUBDIRECTORIES],
  };
}
