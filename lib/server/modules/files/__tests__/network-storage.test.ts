import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockDataRoot = "";

vi.mock("@/lib/server/storage/data-root", () => ({
  ensureDataRootDirectories: vi.fn(async () => ({
    dataRoot: mockDataRoot,
    subdirectories: ["Network", "Trash"],
  })),
}));

vi.mock("@/lib/server/modules/files/network-shares-repository", () => ({
  listNetworkSharesFromDb: vi.fn(),
  getNetworkShareFromDb: vi.fn(),
  getNetworkShareByMountPathFromDb: vi.fn(),
  insertNetworkShareInDb: vi.fn(),
  touchNetworkShareInDb: vi.fn(),
  deleteNetworkShareFromDb: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

import { execFile } from "node:child_process";
import {
  addShare,
  discoverServers,
  discoverShares,
  mountShare,
  type NetworkStorageError,
} from "@/lib/server/modules/files/network-storage";
import {
  getNetworkShareByMountPathFromDb,
  getNetworkShareFromDb,
  insertNetworkShareInDb,
  touchNetworkShareInDb,
} from "@/lib/server/modules/files/network-shares-repository";
import { encryptSecret } from "@/lib/server/modules/files/secrets";

type ExecFileCallback = (error: Error | null, stdout: string, stderr: string) => void;

function getExecFileCallback(restArgs: unknown[]) {
  const callback = restArgs.at(-1);
  if (typeof callback !== "function") {
    throw new Error("Missing execFile callback");
  }
  return callback as ExecFileCallback;
}

describe("network storage service", () => {
  beforeEach(async () => {
    mockDataRoot = await mkdtemp(path.join(os.tmpdir(), "home-server-network-"));
    await mkdir(path.join(mockDataRoot, "Network"), { recursive: true });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (mockDataRoot) {
      await rm(mockDataRoot, { recursive: true, force: true });
    }
  });

  it("rejects duplicate share mount paths", async () => {
    vi.mocked(getNetworkShareByMountPathFromDb).mockResolvedValueOnce({
      id: "existing",
      host: "nas.local",
      share: "Media",
      username: "user",
      mountPath: "Network/nas.local/Media",
      passwordCiphertext: "x",
      passwordIv: "x",
      passwordTag: "x",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      addShare({
        host: "nas.local",
        share: "Media",
        username: "user",
        password: "secret",
      }),
    ).rejects.toMatchObject<Partial<NetworkStorageError>>({
      code: "share_exists",
      statusCode: 409,
    });
  });

  it("parses discovered SMB servers", async () => {
    vi.mocked(execFile).mockImplementation(
      (command: string, ...restArgs: unknown[]) => {
        const callback = getExecFileCallback(restArgs);
        if (command === "avahi-browse") {
          callback(
            null,
            `=;eth0;IPv4;NAS;_smb._tcp;local;nas.local;192.168.1.5;445\n=;eth0;IPv4;NAS;_smb._tcp;local;nas.local;192.168.1.5;445`,
            "",
          );
          return {} as never;
        }

        callback(new Error(`Unexpected command ${command}`), "", "");
        return {} as never;
      },
    );

    const result = await discoverServers();
    expect(result.servers).toEqual(["nas.local"]);
  });

  it("returns empty servers when avahi-browse is unavailable", async () => {
    vi.mocked(execFile).mockImplementation(
      (command: string, ...restArgs: unknown[]) => {
        const callback = getExecFileCallback(restArgs);
        if (command === "avahi-browse") {
          const error = new Error("spawn avahi-browse ENOENT") as Error & {
            code?: string;
          };
          error.code = "ENOENT";
          callback(error, "", "");
          return {} as never;
        }

        callback(new Error(`Unexpected command ${command}`), "", "");
        return {} as never;
      },
    );

    const result = await discoverServers();
    expect(result.servers).toEqual([]);
  });

  it("parses discovered SMB shares", async () => {
    vi.mocked(execFile).mockImplementation(
      (command: string, ...restArgs: unknown[]) => {
        const callback = getExecFileCallback(restArgs);
        if (command === "smbclient") {
          callback(
            null,
            `Disk|Media|Network Share\nDisk|Backups|Network Share\nDisk|IPC$|IPC`,
            "",
          );
          return {} as never;
        }

        callback(new Error(`Unexpected command ${command}`), "", "");
        return {} as never;
      },
    );

    const result = await discoverShares({
      host: "nas.local",
      username: "user",
      password: "secret",
    });

    expect(result.shares).toEqual(["Backups", "Media"]);
  });

  it("returns empty shares when smbclient is unavailable", async () => {
    vi.mocked(execFile).mockImplementation(
      (command: string, ...restArgs: unknown[]) => {
        const callback = getExecFileCallback(restArgs);
        if (command === "smbclient") {
          const error = new Error("spawn smbclient ENOENT") as Error & {
            code?: string;
          };
          error.code = "ENOENT";
          callback(error, "", "");
          return {} as never;
        }

        callback(new Error(`Unexpected command ${command}`), "", "");
        return {} as never;
      },
    );

    const result = await discoverShares({
      host: "nas.local",
      username: "user",
      password: "secret",
    });

    expect(result.shares).toEqual([]);
  });

  it("mounts an existing share", async () => {
    const encrypted = encryptSecret("secret");
    vi.mocked(getNetworkShareFromDb).mockResolvedValueOnce({
      id: "share-1",
      host: "nas.local",
      share: "Media",
      username: "user",
      mountPath: "Network/nas.local/Media",
      passwordCiphertext: encrypted.ciphertext,
      passwordIv: encrypted.iv,
      passwordTag: encrypted.tag,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(touchNetworkShareInDb).mockResolvedValueOnce({
      id: "share-1",
      host: "nas.local",
      share: "Media",
      username: "user",
      mountPath: "Network/nas.local/Media",
      passwordCiphertext: encrypted.ciphertext,
      passwordIv: encrypted.iv,
      passwordTag: encrypted.tag,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(execFile).mockImplementation(
      (command: string, ...restArgs: unknown[]) => {
        const callback = getExecFileCallback(restArgs);
        if (command === "mountpoint") {
          const error = new Error("not mounted") as Error & { code?: number };
          error.code = 1;
          callback(error, "", "");
          return {} as never;
        }

        if (command === "mount") {
          callback(null, "", "");
          return {} as never;
        }

        callback(new Error(`Unexpected command ${command}`), "", "");
        return {} as never;
      },
    );

    const mounted = await mountShare("share-1");

    expect(mounted.isMounted).toBe(true);
    expect(vi.mocked(insertNetworkShareInDb)).not.toHaveBeenCalled();
  });
});
