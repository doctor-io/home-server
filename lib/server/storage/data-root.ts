import "server-only";

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { serverEnv } from "@/lib/server/env";

const DATA_SUBDIRECTORIES = ["Apps", "Documents", "Media", "Download"] as const;

export function resolveStoreStacksRoot() {
  return path.isAbsolute(serverEnv.STORE_STACKS_ROOT)
    ? serverEnv.STORE_STACKS_ROOT
    : path.resolve(process.cwd(), serverEnv.STORE_STACKS_ROOT);
}

export function resolveDataRootDirectory() {
  return path.dirname(resolveStoreStacksRoot());
}

export async function ensureDataRootDirectories() {
  const dataRoot = resolveDataRootDirectory();

  await Promise.all(
    DATA_SUBDIRECTORIES.map((name) =>
      mkdir(path.join(dataRoot, name), { recursive: true }),
    ),
  );

  return {
    dataRoot,
    subdirectories: [...DATA_SUBDIRECTORIES],
  };
}
