export type ServerCpuInfo = {
  manufacturer: string | null;
  brand: string | null;
  speedGhz: number | null;
  maxSpeedGhz: number | null;
  cores: number | null;
  physicalCores: number | null;
  processors: number | null;
  socket: string | null;
  governor: string | null;
};

export type ServerGpuController = {
  vendor: string | null;
  model: string | null;
  bus: string | null;
  vramBytes: number | null;
  subVendor: string | null;
};

export type ServerMemorySlot = {
  bank: string | null;
  type: string | null;
  formFactor: string | null;
  sizeBytes: number | null;
  clockSpeedMhz: number | null;
  manufacturer: string | null;
};

export type ServerOsInfo = {
  platform: string | null;
  distro: string | null;
  release: string | null;
  kernel: string | null;
  arch: string | null;
  codename: string | null;
  hostname: string | null;
};

export type ServerSystemInfo = {
  manufacturer: string | null;
  model: string | null;
  version: string | null;
  serial: string | null;
  uuid: string | null;
  sku: string | null;
};

export type ServerBiosInfo = {
  vendor: string | null;
  version: string | null;
  releaseDate: string | null;
  revision: string | null;
};

export type ServerBaseboardInfo = {
  manufacturer: string | null;
  model: string | null;
  version: string | null;
};

export type ServerBatteryInfo = {
  hasBattery: boolean;
  manufacturer: string | null;
  maxCapacityWh: number | null;
  designedCapacityWh: number | null;
  cycleCount: number | null;
};

export type ServerHardwareInfo = {
  fetchedAt: string;
  os: ServerOsInfo;
  system: ServerSystemInfo;
  bios: ServerBiosInfo;
  baseboard: ServerBaseboardInfo;
  cpu: ServerCpuInfo;
  memory: {
    totalBytes: number;
    slots: ServerMemorySlot[];
  };
  gpu: {
    controllers: ServerGpuController[];
  };
  battery: ServerBatteryInfo;
};
