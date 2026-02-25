import "server-only";

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { serverEnv } from "@/lib/server/env";

const DATA_SUBDIRECTORIES = ["Apps", "Documents", "Media", "Download"] as const;

let resolvedDataRoot: string | null = null;

export function resolveStoreStacksRoot() {
  // If we've already resolved a fallback, use it
  if (resolvedDataRoot) {
    return path.join(resolvedDataRoot, "Apps");
  }

  return path.isAbsolute(serverEnv.STORE_STACKS_ROOT)
    ? serverEnv.STORE_STACKS_ROOT
    : path.resolve(process.cwd(), serverEnv.STORE_STACKS_ROOT);
}

export function resolveDataRootDirectory() {
  if (resolvedDataRoot) {
    return resolvedDataRoot;
  }
  return path.dirname(resolveStoreStacksRoot());
}

export async function ensureDataRootDirectories() {
  const primaryDataRoot = path.dirname(resolveStoreStacksRoot());
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
    const errorMessage = error instanceof Error ? error.message : "unknown error";
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
