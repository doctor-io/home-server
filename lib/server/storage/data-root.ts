import "server-only";

import { serverEnv } from "@/lib/server/env";
import { mkdir } from "node:fs/promises";
import path from "node:path";

export const DATA_SUBDIRECTORIES = [
  "AppData",
  "Documents",
  "Media",
  "Download",
  ".Shared",
  ".Network",
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
  const configured = resolveConfiguredPath(serverEnv.STORE_STACKS_ROOT);
  if (!resolvedDataRoot) {
    return configured;
  }

  const primaryDataRoot = resolvePrimaryDataRoot();
  if (resolvedDataRoot === primaryDataRoot) {
    return configured;
  }

  return path.join(resolvedDataRoot, "Apps");
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

  return path.join(resolvedDataRoot, "AppData");
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

  if (primaryDataRoot === "/") {
    console.warn(
      `[Storage] STORE_STACKS_ROOT is set to "${serverEnv.STORE_STACKS_ROOT}" — its parent directory ` +
        `resolves to "/", which is the filesystem root and is not a valid data root. ` +
        `STORE_STACKS_ROOT must be nested at least one level inside a writable volume mount ` +
        `(e.g. /DATA/stacks instead of /stacks). Falling back to ${fallbackDataRoot}.`,
    );
  }

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
