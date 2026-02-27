import "server-only";

import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { logServerAction } from "@/lib/server/logging/logger";
import {
  FilesPathError,
  resolvePathWithinFilesRoot,
} from "@/lib/server/modules/files/path-resolver";
import {
  deleteNetworkShareFromDb,
  getNetworkShareByMountPathFromDb,
  getNetworkShareFromDb,
  insertNetworkShareInDb,
  listNetworkSharesFromDb,
  touchNetworkShareInDb,
  type NetworkShareRecord,
} from "@/lib/server/modules/files/network-shares-repository";
import { decryptSecret, encryptSecret } from "@/lib/server/modules/files/secrets";
import type {
  CreateNetworkShareRequest,
  DiscoverServersResponse,
  DiscoverSharesResponse,
  FileServiceErrorCode,
  NetworkShare,
  NetworkShareStatus,
} from "@/lib/shared/contracts/files";

const execFileAsync = promisify(execFile);

const WATCH_INTERVAL_MS = 60_000;

let watcherTimer: NodeJS.Timeout | null = null;
let watcherRunning = false;
let watcherTickInFlight = false;

export class NetworkStorageError extends Error {
  readonly code: FileServiceErrorCode;
  readonly statusCode: number;

  constructor(
    message: string,
    options?: {
      code?: FileServiceErrorCode;
      statusCode?: number;
      cause?: unknown;
    },
  ) {
    super(message, {
      cause: options?.cause,
    });
    this.name = "NetworkStorageError";
    this.code = options?.code ?? "internal_error";
    this.statusCode = options?.statusCode ?? 500;
  }
}

type ResolvedMountPath = {
  rootPath: string;
  relativePath: string;
  absolutePath: string;
};

function sanitizeSegment(input: string, fallback: string) {
  const sanitized = input
    .trim()
    .replace(/[^a-zA-Z0-9\-\.\' \(\)_]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return sanitized.length > 0 ? sanitized : fallback;
}

async function resolveMountPath(mountPath: string): Promise<ResolvedMountPath> {
  try {
    const resolved = await resolvePathWithinFilesRoot({
      inputPath: mountPath,
      requiredPrefix: "Network",
      allowHiddenSegments: false,
      allowMissingLeaf: true,
    });

    return {
      rootPath: resolved.rootPath,
      relativePath: resolved.relativePath,
      absolutePath: resolved.absolutePath,
    };
  } catch (error) {
    if (error instanceof FilesPathError) {
      throw new NetworkStorageError(error.message, {
        code: error.code,
        statusCode: error.statusCode,
        cause: error,
      });
    }
    throw error;
  }
}

function mountPathForShare(host: string, share: string) {
  const hostSegment = sanitizeSegment(host, "host");
  const shareSegment = sanitizeSegment(share, "share");
  return path.posix.join("Network", hostSegment, shareSegment);
}

function escapeMountOptionValue(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll(",", "\\,");
}

function mapCommandError(
  error: unknown,
  fallbackMessage: string,
  code: FileServiceErrorCode,
) {
  if (error instanceof NetworkStorageError) return error;

  return new NetworkStorageError(fallbackMessage, {
    code,
    statusCode: code === "share_not_found" ? 404 : 500,
    cause: error,
  });
}

function isCommandUnavailable(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const err = error as {
    code?: string;
    message?: string;
    stderr?: string;
  };

  if (err.code === "ENOENT") return true;

  const combined = `${err.message ?? ""}\n${err.stderr ?? ""}`.toLowerCase();
  return (
    combined.includes("not found") ||
    combined.includes("no such file or directory")
  );
}

async function runCommand(command: string, args: string[]) {
  const result = await execFileAsync(command, args, {
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
  });

  if (typeof result === "string" || Buffer.isBuffer(result)) {
    return {
      stdout: result,
      stderr: "",
    };
  }

  if (result && typeof result === "object" && "stdout" in result) {
    const castResult = result as { stdout?: string | Buffer; stderr?: string | Buffer };
    return {
      stdout: castResult.stdout ?? "",
      stderr: castResult.stderr ?? "",
    };
  }

  return {
    stdout: "",
    stderr: "",
  };
}

async function isMounted(mountPath: string) {
  const resolved = await resolveMountPath(mountPath);

  try {
    await runCommand("mountpoint", ["-q", resolved.absolutePath]);
    return true;
  } catch {
    return false;
  }
}

function toPublicShare(record: NetworkShareRecord): NetworkShare {
  return {
    id: record.id,
    host: record.host,
    share: record.share,
    username: record.username,
    mountPath: record.mountPath,
  };
}

function toShareStatus(record: NetworkShareRecord, mounted: boolean): NetworkShareStatus {
  return {
    ...toPublicShare(record),
    isMounted: mounted,
  };
}

async function mountShareRecord(record: NetworkShareRecord) {
  const resolved = await resolveMountPath(record.mountPath);
  await mkdir(resolved.absolutePath, {
    recursive: true,
  });

  const alreadyMounted = await isMounted(record.mountPath);
  if (alreadyMounted) {
    return;
  }

  const password = decryptSecret({
    ciphertext: record.passwordCiphertext,
    iv: record.passwordIv,
    tag: record.passwordTag,
  });

  const smbPath = `//${record.host}/${record.share}`;
  const mountOptions = [
    `username=${escapeMountOptionValue(record.username)}`,
    `password=${escapeMountOptionValue(password)}`,
    "uid=1000",
    "gid=1000",
    "iocharset=utf8",
  ].join(",");

  await runCommand("mount", [
    "-t",
    "cifs",
    smbPath,
    resolved.absolutePath,
    "-o",
    mountOptions,
  ]);
}

async function unmountShareRecord(record: NetworkShareRecord) {
  const resolved = await resolveMountPath(record.mountPath);
  const mounted = await isMounted(record.mountPath);

  if (mounted) {
    await runCommand("umount", [resolved.absolutePath]);
  }

  await rm(resolved.absolutePath, {
    recursive: false,
    force: true,
  });

  const hostDirectory = path.dirname(resolved.absolutePath);
  try {
    const entries = await readdir(hostDirectory);
    if (entries.length === 0) {
      await rm(hostDirectory, {
        recursive: false,
        force: true,
      });
    }
  } catch {
    // ignored
  }
}

async function runWatcherTick() {
  if (watcherTickInFlight) return;
  watcherTickInFlight = true;

  try {
    const shares = await listNetworkSharesFromDb();
    await Promise.all(
      shares.map(async (share) => {
        try {
          const mounted = await isMounted(share.mountPath);
          if (!mounted) {
            await mountShareRecord(share);
            await touchNetworkShareInDb(share.id);
          }
        } catch (error) {
          logServerAction({
            level: "warn",
            layer: "service",
            action: "files.network.watch.mount",
            status: "error",
            message: "Failed to mount network share during watcher tick",
            meta: {
              shareId: share.id,
              mountPath: share.mountPath,
            },
            error,
          });
        }
      }),
    );
  } finally {
    watcherTickInFlight = false;
  }
}

export function startNetworkStorageWatcher() {
  if (watcherRunning) return;

  watcherRunning = true;
  watcherTimer = setInterval(() => {
    void runWatcherTick();
  }, WATCH_INTERVAL_MS);
  watcherTimer.unref?.();
  void runWatcherTick();
}

export async function stopNetworkStorageWatcher() {
  watcherRunning = false;

  if (watcherTimer) {
    clearInterval(watcherTimer);
    watcherTimer = null;
  }
}

export async function getShareInfo(): Promise<NetworkShareStatus[]> {
  const shares = await listNetworkSharesFromDb();

  const statuses = await Promise.all(
    shares.map(async (share) => {
      let mounted = false;
      try {
        mounted = await isMounted(share.mountPath);
      } catch (error) {
        logServerAction({
          level: "warn",
          layer: "service",
          action: "files.network.shares.get.status",
          status: "error",
          message: "Failed to resolve network share mount status",
          meta: {
            shareId: share.id,
            mountPath: share.mountPath,
          },
          error,
        });
      }
      return toShareStatus(share, mounted);
    }),
  );

  return statuses;
}

export async function addShare(input: CreateNetworkShareRequest) {
  const host = input.host.trim();
  const share = input.share.trim();
  const username = input.username.trim();
  const password = input.password;

  if (!host || !share || !username || !password) {
    throw new NetworkStorageError("Invalid share payload", {
      code: "invalid_path",
      statusCode: 400,
    });
  }

  const mountPath = mountPathForShare(host, share);
  const existing = await getNetworkShareByMountPathFromDb(mountPath);
  if (existing) {
    throw new NetworkStorageError("Network share already exists", {
      code: "share_exists",
      statusCode: 409,
    });
  }

  const encrypted = encryptSecret(password);
  const created = await insertNetworkShareInDb({
    id: randomUUID(),
    host,
    share,
    username,
    mountPath,
    passwordCiphertext: encrypted.ciphertext,
    passwordIv: encrypted.iv,
    passwordTag: encrypted.tag,
  });

  try {
    await mountShareRecord(created);
    await touchNetworkShareInDb(created.id);

    return {
      ...toPublicShare(created),
      isMounted: true,
    } satisfies NetworkShareStatus;
  } catch (error) {
    try {
      await deleteNetworkShareFromDb(created.id);
    } catch (rollbackError) {
      throw new NetworkStorageError(
        "Failed to mount network share and rollback reservation",
        {
          code: "internal_error",
          statusCode: 500,
          cause: {
            error,
            rollbackError,
          },
        },
      );
    }
    throw mapCommandError(error, "Failed to mount network share", "mount_failed");
  }
}

export async function removeShare(shareId: string) {
  const share = await getNetworkShareFromDb(shareId);
  if (!share) {
    throw new NetworkStorageError("Network share not found", {
      code: "share_not_found",
      statusCode: 404,
    });
  }

  try {
    await unmountShareRecord(share);
  } catch (error) {
    throw mapCommandError(error, "Failed to unmount network share", "unmount_failed");
  }

  await deleteNetworkShareFromDb(share.id);
  return {
    removed: true,
    id: share.id,
  };
}

export async function mountShare(shareId: string) {
  const share = await getNetworkShareFromDb(shareId);
  if (!share) {
    throw new NetworkStorageError("Network share not found", {
      code: "share_not_found",
      statusCode: 404,
    });
  }

  try {
    await mountShareRecord(share);
    const updated = (await touchNetworkShareInDb(share.id)) ?? share;
    return toShareStatus(updated, true);
  } catch (error) {
    throw mapCommandError(error, "Failed to mount network share", "mount_failed");
  }
}

export async function unmountShare(shareId: string) {
  const share = await getNetworkShareFromDb(shareId);
  if (!share) {
    throw new NetworkStorageError("Network share not found", {
      code: "share_not_found",
      statusCode: 404,
    });
  }

  try {
    await unmountShareRecord(share);
    const updated = (await touchNetworkShareInDb(share.id)) ?? share;
    return toShareStatus(updated, false);
  } catch (error) {
    throw mapCommandError(error, "Failed to unmount network share", "unmount_failed");
  }
}

export async function discoverServers(): Promise<DiscoverServersResponse> {
  try {
    const { stdout } = await runCommand("avahi-browse", [
      "--resolve",
      "--terminate",
      "_smb._tcp",
      "--parsable",
    ]);

    const output =
      typeof stdout === "string"
        ? stdout
        : Buffer.isBuffer(stdout)
          ? stdout.toString("utf8")
          : "";
    const servers = output
      .split("\n")
      .map((line) => line.split(";")[6]?.trim() ?? "")
      .filter((value) => value.length > 0);

    return {
      servers: Array.from(new Set(servers)).sort((a, b) =>
        a.localeCompare(b),
      ),
    };
  } catch (error) {
    if (isCommandUnavailable(error)) {
      logServerAction({
        level: "warn",
        layer: "service",
        action: "files.network.discover.servers.unavailable",
        status: "error",
        message: "SMB server discovery command is unavailable",
        error,
      });
      return { servers: [] };
    }

    throw mapCommandError(error, "Failed to discover SMB servers", "internal_error");
  }
}

export async function discoverShares(input: {
  host: string;
  username: string;
  password: string;
}): Promise<DiscoverSharesResponse> {
  const host = input.host.trim();
  const username = input.username.trim();
  const password = input.password;

  if (!host || !username || !password) {
    throw new NetworkStorageError("Invalid share discovery payload", {
      code: "invalid_path",
      statusCode: 400,
    });
  }

  try {
    const { stdout } = await runCommand("smbclient", [
      "--list",
      `//${host}`,
      "--user",
      username,
      "--password",
      password,
      "--grepable",
    ]);

    const output =
      typeof stdout === "string"
        ? stdout
        : Buffer.isBuffer(stdout)
          ? stdout.toString("utf8")
          : "";
    const shares = output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => line.split("|").length === 3)
      .map((line) => line.split("|")[1]?.trim() ?? "")
      .filter((shareName) => shareName.length > 0 && shareName !== "IPC$");

    return {
      shares: Array.from(new Set(shares)).sort((a, b) =>
        a.localeCompare(b),
      ),
    };
  } catch (error) {
    if (isCommandUnavailable(error)) {
      logServerAction({
        level: "warn",
        layer: "service",
        action: "files.network.discover.shares.unavailable",
        status: "error",
        message: "SMB share discovery command is unavailable",
        meta: { host },
        error,
      });
      return { shares: [] };
    }

    throw mapCommandError(
      error,
      "Failed to discover SMB shares for host",
      "internal_error",
    );
  }
}

export async function isShareMounted(shareId: string) {
  const share = await getNetworkShareFromDb(shareId);
  if (!share) {
    throw new NetworkStorageError("Network share not found", {
      code: "share_not_found",
      statusCode: 404,
    });
  }

  const mounted = await isMounted(share.mountPath);
  return toShareStatus(share, mounted);
}

export async function assertMountPathIsSafe(mountPath: string) {
  const resolved = await resolveMountPath(mountPath);
  const info = await lstat(resolved.absolutePath).catch(() => null);
  if (info?.isSymbolicLink()) {
    throw new NetworkStorageError("Symlinks are not allowed", {
      code: "symlink_blocked",
      statusCode: 403,
    });
  }

  return resolved;
}
