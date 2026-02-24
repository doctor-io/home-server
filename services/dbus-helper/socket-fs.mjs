import { execFileSync } from "node:child_process";
import { chmod, chown, mkdir, unlink } from "node:fs/promises";
import { dirname } from "node:path";

function resolveGroupId(groupName) {
  try {
    const raw = execFileSync("getent", ["group", groupName], {
      encoding: "utf8",
    }).trim();
    const parts = raw.split(":");
    const gid = Number.parseInt(parts[2] ?? "", 10);
    return Number.isFinite(gid) ? gid : null;
  } catch {
    return null;
  }
}

async function ensureSocketDirectory(socketPath, groupName) {
  const directory = dirname(socketPath);
  await mkdir(directory, {
    recursive: true,
  });

  const gid = resolveGroupId(groupName);
  if (gid !== null) {
    await chown(directory, 0, gid).catch(() => {});
  }
  await chmod(directory, 0o770).catch(() => {});
}

async function ensureSocketPermissions(socketPath, groupName) {
  const gid = resolveGroupId(groupName);
  if (gid !== null) {
    await chown(socketPath, 0, gid).catch(() => {});
  }
  await chmod(socketPath, 0o660).catch(() => {});
}

async function safeUnlink(socketPath) {
  await unlink(socketPath).catch(() => {});
}

export { ensureSocketDirectory, ensureSocketPermissions, safeUnlink };
