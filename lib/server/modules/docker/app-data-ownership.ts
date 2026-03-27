import "server-only";

import { chown, lstat, readdir } from "node:fs/promises";
import path from "node:path";

export type BindMountOwnershipOverride = {
  directoryPath: string;
  uid: number;
  gid: number;
};

export type OwnershipResolutionSource =
  | "service-user"
  | "puid-pgid"
  | "image-rule"
  | "fallback";

export type ServiceOwnershipResolution =
  | {
    source: "service-user" | "puid-pgid" | "image-rule";
    uid: number;
    gid: number;
  }
  | {
    source: "fallback";
    uid: null;
    gid: null;
  };

type ServiceOwnershipContext = {
  image: string | null;
  user: string | null;
  env: Record<string, string>;
};

type OwnershipRule = {
  imagePatterns: RegExp[];
  targetPaths: Set<string>;
  uid: number;
  gid: number;
};

type OwnershipFilesystem = {
  chown: typeof chown;
  lstat: typeof lstat;
  readdir: typeof readdir;
};

const ownershipFilesystem: OwnershipFilesystem = {
  chown,
  lstat,
  readdir,
};

const bindMountOwnershipRules: OwnershipRule[] = [
  {
    imagePatterns: [/^grafana\/grafana(?::|@|$)/i],
    targetPaths: new Set(["/var/lib/grafana"]),
    uid: 472,
    gid: 472,
  },
  {
    imagePatterns: [/^n8nio\/n8n(?::|@|$)/i],
    targetPaths: new Set(["/home/node/.n8n"]),
    uid: 1000,
    gid: 1000,
  },
  // Uptime Kuma runs as uid 1000 internally; no PUID/PGID env vars are used.
  {
    imagePatterns: [/^louislam\/uptime-kuma(?::|@|$)/i],
    targetPaths: new Set(["/app/data"]),
    uid: 1000,
    gid: 1000,
  },
  // Official Jellyfin image (non-linuxserver) runs as jellyfin user (uid 1000).
  // linuxserver/jellyfin is handled automatically via PUID/PGID env var parsing.
  {
    imagePatterns: [/^jellyfin\/jellyfin(?::|@|$)/i, /^ghcr\.io\/jellyfin\/jellyfin(?::|@|$)/i],
    targetPaths: new Set(["/config", "/cache"]),
    uid: 1000,
    gid: 1000,
  },
  // Cloudflared runs as the "nonroot" user (uid 65532) from distroless base.
  {
    imagePatterns: [/^cloudflare\/cloudflared(?::|@|$)/i],
    targetPaths: new Set(["/home/nonroot/.cloudflared", "/etc/cloudflared"]),
    uid: 65532,
    gid: 65532,
  },
];

function parseOwnershipPairFromUser(value: string | null) {
  if (!value) return null;

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed === "root") {
    return {
      uid: 0,
      gid: 0,
    };
  }

  const [uidPart, gidPart] = trimmed.split(":");
  if (!uidPart || !gidPart) {
    return null;
  }

  const uid = Number(uidPart.trim());
  const gid = Number(gidPart.trim());
  if (!Number.isInteger(uid) || !Number.isInteger(gid) || uid < 0 || gid < 0) {
    return null;
  }

  return {
    uid,
    gid,
  };
}

function parseOwnershipPairFromPuidPgid(env: Record<string, string>) {
  const puid = env.PUID;
  const pgid = env.PGID;
  if (!puid || !pgid) {
    return null;
  }

  const uid = Number(puid.trim());
  const gid = Number(pgid.trim());
  if (!Number.isInteger(uid) || !Number.isInteger(gid) || uid < 0 || gid < 0) {
    return null;
  }

  return {
    uid,
    gid,
  };
}

function resolveBindMountOwnershipRule(image: string, targetPath: string) {
  return bindMountOwnershipRules.find((rule) => {
    if (!rule.targetPaths.has(targetPath)) {
      return false;
    }

    return rule.imagePatterns.some((pattern) => pattern.test(image));
  }) ?? null;
}

export function classifyServiceBindMountOwnership(
  context: ServiceOwnershipContext & { targetPath: string },
): ServiceOwnershipResolution {
  const explicitUser = parseOwnershipPairFromUser(context.user);
  if (explicitUser) {
    return {
      source: "service-user",
      uid: explicitUser.uid,
      gid: explicitUser.gid,
    };
  }

  const puidPgid = parseOwnershipPairFromPuidPgid(context.env);
  if (puidPgid) {
    return {
      source: "puid-pgid",
      uid: puidPgid.uid,
      gid: puidPgid.gid,
    };
  }

  if (!context.image) {
    return {
      source: "fallback",
      uid: null,
      gid: null,
    };
  }

  const rule = resolveBindMountOwnershipRule(context.image, context.targetPath);
  if (!rule) {
    return {
      source: "fallback",
      uid: null,
      gid: null,
    };
  }

  return {
    source: "image-rule",
    uid: rule.uid,
    gid: rule.gid,
  };
}

async function collectOwnershipApplicationTargetsInternal(
  rootPath: string,
  filesystem: OwnershipFilesystem,
): Promise<string[]> {
  const rootInfo = await filesystem.lstat(rootPath).catch((error: unknown) => {
    const maybe = error as NodeJS.ErrnoException;
    if (maybe?.code === "ENOENT") {
      return null;
    }
    throw error;
  });

  if (rootInfo === null || rootInfo.isSymbolicLink()) {
    return [];
  }

  const targets = [rootPath];
  if (!rootInfo.isDirectory()) {
    return targets;
  }

  const entries = await filesystem.readdir(rootPath, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    const targetPath = path.join(rootPath, entry.name);

    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      targets.push(
        ...(await collectOwnershipApplicationTargetsInternal(targetPath, filesystem)),
      );
      continue;
    }

    targets.push(targetPath);
  }

  return targets;
}

export async function collectOwnershipApplicationTargets(
  rootPath: string,
  filesystem: OwnershipFilesystem = ownershipFilesystem,
) {
  return collectOwnershipApplicationTargetsInternal(rootPath, filesystem);
}

export async function applyBindMountOwnershipOverrides(
  overrides: Iterable<BindMountOwnershipOverride>,
  filesystem: OwnershipFilesystem = ownershipFilesystem,
) {
  const uniqueOverrides = new Map<string, BindMountOwnershipOverride>();
  for (const override of overrides) {
    uniqueOverrides.set(override.directoryPath, override);
  }

  for (const override of uniqueOverrides.values()) {
    const targets = await collectOwnershipApplicationTargets(
      override.directoryPath,
      filesystem,
    );

    for (const targetPath of targets) {
      await filesystem.chown(targetPath, override.uid, override.gid).catch((error: unknown) => {
        const maybe = error as NodeJS.ErrnoException;
        if (maybe?.code === "ENOENT") {
          return;
        }
        throw error;
      });
    }
  }
}
