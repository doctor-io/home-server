import "server-only";

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { promisify } from "node:util";
import type {
  DiskDevice,
  DiskFilesystem,
  DiskMediaType,
  DiskPartition,
} from "@/lib/shared/contracts/disks";

const execFileAsync = promisify(execFile);

// ─── lsblk types ─────────────────────────────────────────────────────────────

type LsblkChild = {
  name: string;
  size: number | null;
  type: string;
  fstype: string | null;
  label: string | null;
  uuid: string | null;
  mountpoint: string | null;
  ro: boolean | string;
  parttype: string | null;
};

type LsblkDevice = {
  name: string;
  model: string | null;
  vendor: string | null;
  serial: string | null;
  size: number | null;
  type: string;
  tran: string | null;
  rm: boolean;
  rota: boolean;
  children?: LsblkChild[];
};

type LsblkOutput = { blockdevices: LsblkDevice[] };

// ─── helpers ──────────────────────────────────────────────────────────────────

function parsePartitionInfo(name: string): { disk: string; number: number } | null {
  // NVMe / eMMC: nvme0n1p2, mmcblk0p1
  const nvme = name.match(/^((?:nvme|mmcblk)\d+(?:n\d+)?)p(\d+)$/);
  if (nvme) return { disk: nvme[1]!, number: parseInt(nvme[2]!, 10) };
  // SATA / SCSI / VirtIO: sda1, vda2, xda10
  const sata = name.match(/^([a-z]+?)(\d+)$/);
  if (sata) return { disk: sata[1]!, number: parseInt(sata[2]!, 10) };
  return null;
}

function mediaTypeFromDevice(dev: LsblkDevice): DiskMediaType {
  if (dev.rm || dev.tran === "usb") return "removable";
  if (dev.tran === "nvme") return "nvme";
  if (dev.rota === false) return "ssd";
  if (dev.rota === true) return "hdd";
  return "unknown";
}

// ─── list ─────────────────────────────────────────────────────────────────────

export async function listDisks(): Promise<DiskDevice[]> {
  let stdout: string;
  try {
    const result = await execFileAsync("lsblk", [
      "--json",
      "--bytes",
      "--output",
      "NAME,MODEL,VENDOR,SERIAL,SIZE,TYPE,FSTYPE,LABEL,UUID,MOUNTPOINT,TRAN,RM,RO,ROTA,PARTTYPE",
    ]);
    stdout = result.stdout;
  } catch {
    return [];
  }

  let parsed: LsblkOutput;
  try {
    parsed = JSON.parse(stdout) as LsblkOutput;
  } catch {
    return [];
  }

  const disks: DiskDevice[] = [];

  for (const dev of parsed.blockdevices ?? []) {
    if (dev.type !== "disk") continue;
    if (dev.name.startsWith("loop") || dev.name.startsWith("ram")) continue;

    const partitions: DiskPartition[] = (dev.children ?? [])
      .filter((c) => c.type === "part" || c.type === "lvm" || c.type === "crypt")
      .map((c) => {
        const info = parsePartitionInfo(c.name);
        return {
          name: c.name,
          device: `/dev/${c.name}`,
          number: info?.number ?? null,
          fstype: c.fstype ?? null,
          label: c.label ?? null,
          uuid: c.uuid ?? null,
          sizeBytes: c.size ?? null,
          mountpoint: c.mountpoint ?? null,
          type: c.type,
          ro: c.ro === true || c.ro === "1",
        };
      });

    disks.push({
      name: dev.name,
      device: `/dev/${dev.name}`,
      model: dev.model?.trim() || null,
      vendor: dev.vendor?.trim() || null,
      serial: dev.serial?.trim() || null,
      sizeBytes: dev.size ?? null,
      mediaType: mediaTypeFromDevice(dev),
      transport: dev.tran ?? null,
      isRemovable: Boolean(dev.rm),
      partitions,
    });
  }

  return disks;
}

// ─── format ───────────────────────────────────────────────────────────────────

const MKFS_COMMAND: Record<DiskFilesystem, string> = {
  ext4: "mkfs.ext4",
  ext3: "mkfs.ext3",
  btrfs: "mkfs.btrfs",
  xfs: "mkfs.xfs",
  ntfs: "mkfs.ntfs",
  vfat: "mkfs.vfat",
  exfat: "mkfs.exfat",
};

const LABEL_FLAG: Record<DiskFilesystem, string> = {
  ext4: "-L",
  ext3: "-L",
  btrfs: "-L",
  xfs: "-L",
  ntfs: "-L",
  vfat: "-n",
  exfat: "-L",
};

export async function formatPartition(
  device: string,
  filesystem: DiskFilesystem,
  label?: string,
): Promise<void> {
  if (!device.startsWith("/dev/")) throw new Error("Invalid device path");

  const cmd = MKFS_COMMAND[filesystem];
  const flag = LABEL_FLAG[filesystem];
  const args: string[] = [];

  if (filesystem === "ntfs") args.push("--fast");
  if (label) args.push(flag, label);

  args.push(device);

  await execFileAsync(cmd, args);
}

// ─── mount ────────────────────────────────────────────────────────────────────

export async function mountPartition(
  device: string,
  mountPoint: string,
  addToFstab = false,
): Promise<void> {
  if (!device.startsWith("/dev/")) throw new Error("Invalid device path");
  if (!mountPoint.startsWith("/")) throw new Error("Mount point must be an absolute path");

  await mkdir(mountPoint, { recursive: true });
  await execFileAsync("mount", [device, mountPoint]);

  if (addToFstab) {
    await appendFstabEntry(device, mountPoint);
  }
}

async function appendFstabEntry(device: string, mountPoint: string): Promise<void> {
  let existing = "";
  try {
    existing = await readFile("/etc/fstab", "utf8");
  } catch {
    // /etc/fstab might not exist on some systems — create it
  }

  // Don't add a duplicate entry
  if (existing.includes(device) || existing.includes(mountPoint)) return;

  const entry = `\n${device}\t${mountPoint}\tauto\tdefaults\t0\t2\n`;
  await writeFile("/etc/fstab", existing + entry, "utf8");
}

// ─── unmount ──────────────────────────────────────────────────────────────────

export async function unmountPartition(device: string): Promise<void> {
  if (!device.startsWith("/dev/")) throw new Error("Invalid device path");
  await execFileAsync("umount", [device]);
}

// ─── create partition ─────────────────────────────────────────────────────────

export async function createPartition(
  disk: string,
  start: string,
  end: string,
): Promise<void> {
  if (!disk.startsWith("/dev/")) throw new Error("Invalid device path");

  // Ensure GPT table exists (safe — no-op if already present)
  try {
    await execFileAsync("parted", ["--script", disk, "mklabel", "gpt"]);
  } catch {
    // Disk may already have a partition table
  }

  await execFileAsync("parted", [
    "--script",
    "--align",
    "optimal",
    disk,
    "mkpart",
    "primary",
    start,
    end,
  ]);
}

// ─── delete partition ─────────────────────────────────────────────────────────

export async function deletePartition(device: string): Promise<void> {
  if (!device.startsWith("/dev/")) throw new Error("Invalid device path");

  const name = device.replace("/dev/", "");
  const info = parsePartitionInfo(name);
  if (!info) throw new Error(`Cannot determine partition number from ${device}`);

  const disk = `/dev/${info.disk}`;
  await execFileAsync("parted", ["--script", disk, "rm", String(info.number)]);
}

// ─── wipe disk ────────────────────────────────────────────────────────────────

export async function wipeDisk(disk: string): Promise<void> {
  if (!disk.startsWith("/dev/")) throw new Error("Invalid device path");

  // wipefs removes all filesystem and partition table signatures
  await execFileAsync("wipefs", ["--all", "--force", disk]);
}
