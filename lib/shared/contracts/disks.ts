export type DiskMediaType = "ssd" | "hdd" | "nvme" | "removable" | "unknown";

export type DiskPartition = {
  name: string;
  device: string;
  number: number | null;
  fstype: string | null;
  label: string | null;
  uuid: string | null;
  sizeBytes: number | null;
  mountpoint: string | null;
  type: string;
  ro: boolean;
};

export type DiskDevice = {
  name: string;
  device: string;
  model: string | null;
  vendor: string | null;
  serial: string | null;
  sizeBytes: number | null;
  mediaType: DiskMediaType;
  transport: string | null;
  isRemovable: boolean;
  partitions: DiskPartition[];
};

export type DiskListResponse = {
  disks: DiskDevice[];
};

export const DISK_FILESYSTEMS = ["ext4", "ext3", "btrfs", "xfs", "ntfs", "vfat", "exfat"] as const;
export type DiskFilesystem = (typeof DISK_FILESYSTEMS)[number];

export type DiskFormatRequest = {
  device: string;
  filesystem: DiskFilesystem;
  label?: string;
};

export type DiskMountRequest = {
  device: string;
  mountPoint: string;
  addToFstab?: boolean;
};

export type DiskUnmountRequest = {
  device: string;
};

export type DiskCreatePartitionRequest = {
  disk: string;
  start: string;
  end: string;
  filesystem?: string;
};

export type DiskDeletePartitionRequest = {
  device: string;
};

export type DiskWipeRequest = {
  disk: string;
};

export type DiskActionResponse = {
  accepted: true;
  action: string;
};
