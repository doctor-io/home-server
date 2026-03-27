import "server-only";

import { existsSync } from "node:fs";
import path from "node:path";
import { serverEnv } from "@/lib/server/env";
import {
  resolveDataRootDirectory,
  resolveStoreStacksRoot,
} from "@/lib/server/storage/data-root";

function uniquePaths(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

export function resolveInstalledComposePath(input: {
  appId: string;
  composePath: string;
  stackName: string;
}) {
  if (existsSync(input.composePath)) {
    return input.composePath;
  }

  const composeFileName = path.basename(input.composePath) || "docker-compose.yml";
  const fallbackComposeNames = uniquePaths([
    composeFileName,
    "docker-compose.yml",
    "docker-compose.yaml",
  ]);
  const stackDirName = path.basename(path.dirname(input.composePath));
  const candidateDirNames = uniquePaths([
    stackDirName,
    input.appId,
    input.stackName,
  ]);
  const dataRoot = resolveDataRootDirectory();
  const filesRoot = serverEnv.FILES_ROOT;
  const candidateRoots = uniquePaths([
    path.dirname(input.composePath),
    resolveStoreStacksRoot(),
    path.join(dataRoot, "Apps"),
    path.join(dataRoot, "stacks"),
    path.join(dataRoot, "data-root", "Apps"),
    path.join(dataRoot, "data-root", "stacks"),
    path.join(filesRoot, "Apps"),
    path.join(filesRoot, "stacks"),
    path.join(filesRoot, "data-root", "Apps"),
    path.join(filesRoot, "data-root", "stacks"),
  ]);

  for (const root of candidateRoots) {
    for (const dirName of candidateDirNames) {
      for (const fileName of fallbackComposeNames) {
        const candidate = path.join(root, dirName, fileName);
        if (existsSync(candidate)) {
          return candidate;
        }
      }
    }
  }

  return input.composePath;
}
