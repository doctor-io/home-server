import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  classifyServiceBindMountOwnership,
  collectOwnershipApplicationTargets,
} from "@/lib/server/modules/docker/app-data-ownership";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((rootPath) =>
      rm(rootPath, { recursive: true, force: true })
    ),
  );
});

describe("app-data-ownership", () => {
  it("prefers an explicit numeric service user over image-specific rules", () => {
    expect(
      classifyServiceBindMountOwnership({
        image: "grafana/grafana:12.1.4",
        user: "1234:5678",
        env: {},
        targetPath: "/var/lib/grafana",
      }),
    ).toEqual({
      source: "service-user",
      uid: 1234,
      gid: 5678,
    });
  });

  it("treats root as an explicit service user", () => {
    expect(
      classifyServiceBindMountOwnership({
        image: "grafana/grafana:12.1.4",
        user: "root",
        env: {},
        targetPath: "/var/lib/grafana",
      }),
    ).toEqual({
      source: "service-user",
      uid: 0,
      gid: 0,
    });
  });

  it("prefers PUID and PGID over image-specific rules", () => {
    expect(
      classifyServiceBindMountOwnership({
        image: "grafana/grafana:12.1.4",
        user: null,
        env: {
          PUID: "1001",
          PGID: "1002",
        },
        targetPath: "/var/lib/grafana",
      }),
    ).toEqual({
      source: "puid-pgid",
      uid: 1001,
      gid: 1002,
    });
  });

  it("falls back to known image rules when no explicit user or PUID/PGID is set", () => {
    expect(
      classifyServiceBindMountOwnership({
        image: "n8nio/n8n:1.123.0",
        user: null,
        env: {},
        targetPath: "/home/node/.n8n",
      }),
    ).toEqual({
      source: "image-rule",
      uid: 1000,
      gid: 1000,
    });
  });

  it("returns fallback when no ownership override can be inferred", () => {
    expect(
      classifyServiceBindMountOwnership({
        image: "nginx:latest",
        user: null,
        env: {},
        targetPath: "/usr/share/nginx/html",
      }),
    ).toEqual({
      source: "fallback",
      uid: null,
      gid: null,
    });
  });

  it("collects nested ownership targets and skips symbolic links", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "ownership-targets-"));
    tempRoots.push(rootPath);

    const appDataPath = path.join(rootPath, "AppData", "grafana");
    const nestedDir = path.join(appDataPath, "data", "plugins");
    const nestedFile = path.join(nestedDir, "plugin.json");
    const siblingFile = path.join(appDataPath, "data", "grafana.db");
    const symlinkPath = path.join(appDataPath, "data", "linked-config");

    await mkdir(nestedDir, { recursive: true });
    await writeFile(nestedFile, "{}", "utf8");
    await writeFile(siblingFile, "db", "utf8");
    await symlink(path.join(rootPath, "elsewhere"), symlinkPath);

    const targets = await collectOwnershipApplicationTargets(path.join(appDataPath, "data"));

    expect(targets.sort((a, b) => a.localeCompare(b))).toEqual([
      path.join(appDataPath, "data"),
      path.join(appDataPath, "data", "grafana.db"),
      path.join(appDataPath, "data", "plugins"),
      path.join(appDataPath, "data", "plugins", "plugin.json"),
    ]);
  });
});
