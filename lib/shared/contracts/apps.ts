export type InstalledApp = {
  id: string;
  name: string;
  stackName: string;
  composePath: string;
  webUiPort?: number | null;
  containerName?: string | null;
  status: "running" | "stopped" | "unknown";
  updatedAt: string;
};

export type InstalledStackStatus =
  | "installed"
  | "not_installed"
  | "installing"
  | "error"
  | "updating"
  | "uninstalling";

export type StoreOperationAction = "install" | "redeploy" | "uninstall";

export type StoreOperationStatus = "queued" | "running" | "success" | "error";

export type StoreAppEnvDefinition = {
  name: string;
  label?: string;
  description?: string;
  default?: string;
};

export type StoreAppSummary = {
  id: string;
  name: string;
  description: string;
  platform: string;
  categories: string[];
  logoUrl: string | null;
  repositoryUrl: string;
  stackFile: string;
  status: InstalledStackStatus;
  webUiPort: number | null;
  updateAvailable: boolean;
  localDigest: string | null;
  remoteDigest: string | null;
};

export type StoreAppDetail = StoreAppSummary & {
  note: string;
  env: StoreAppEnvDefinition[];
  installedConfig: InstalledStackConfig | null;
};

export type InstalledStackConfig = {
  appId: string;
  templateName: string;
  stackName: string;
  composePath: string;
  status: InstalledStackStatus;
  webUiPort: number | null;
  env: Record<string, string>;
  displayName: string | null;
  iconUrl: string | null;
  installedAt: string | null;
  updatedAt: string;
  isUpToDate: boolean;
  lastUpdateCheck: string | null;
  localDigest: string | null;
  remoteDigest: string | null;
};

export type DockerPullProgressDetail = {
  current: number;
  total: number;
  percent: number | null;
};

export type StoreOperation = {
  id: string;
  appId: string;
  action: StoreOperationAction;
  status: StoreOperationStatus;
  progressPercent: number;
  currentStep: string;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
};

export type StoreOperationEventType =
  | "operation.started"
  | "operation.step"
  | "operation.pull.progress"
  | "operation.completed"
  | "operation.failed";

export type StoreOperationEvent = {
  type: StoreOperationEventType;
  operationId: string;
  appId: string;
  action: StoreOperationAction;
  status: StoreOperationStatus;
  timestamp: string;
  progressPercent: number;
  step: string;
  message?: string;
  image?: string;
  dockerStatus?: string;
  progressDetail?: DockerPullProgressDetail;
};
