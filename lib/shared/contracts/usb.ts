export type UsbPartition = {
  name: string;
  fstype: string | null;
  label: string | null;
  uuid: string | null;
  size: string;
  mountpoint: string | null;
};

export type UsbDrive = {
  id: string;
  device: string;
  vendor: string | null;
  model: string | null;
  size: string;
  partitions: UsbPartition[];
  isMounted: boolean;
  mountpoint: string | null;
  label: string;
};

export type UsbDrivesResponse = {
  drives: UsbDrive[];
};

export type UsbSseEvent =
  | { type: "usb.connected"; drive: UsbDrive }
  | { type: "usb.disconnected"; driveId: string }
  | { type: "usb.mounted"; drive: UsbDrive }
  | { type: "usb.unmounted"; driveId: string };
