import "server-only";

import { randomUUID } from "node:crypto";
import {
  extractComposeImages,
  materializeInlineStackFiles,
  materializeStackFiles,
  runComposeDown,
  runComposeUp,
  sanitizeStackName,
} from "@/lib/server/modules/store/compose-runner";
import { findStoreCatalogTemplateByAppId } from "@/lib/server/modules/store/catalog";
import {
  findCustomStoreTemplateByAppId,
  isCustomStoreTemplate,
} from "@/lib/server/modules/store/custom-apps";
import { pullDockerImage } from "@/lib/server/modules/store/docker-client";
import {
  createStoreOperation,
  findInstalledStackByAppId,
  findStackByWebUiPort,
  findStoreOperationById,
  markStackAsNotInstalled,
  updateStoreOperation,
  upsertInstalledStack,
} from "@/lib/server/modules/store/repository";
import { logServerAction } from "@/lib/server/logging/logger";
import type {
  InstalledStackConfig,
  StoreOperation,
  StoreOperationAction,
  StoreOperationEvent,
  StoreOperationStatus,
} from "@/lib/shared/contracts/apps";

type OperationParams = {
  appId: string;
  action: StoreOperationAction;
  displayName?: string;
  env?: Record<string, string>;
  webUiPort?: number;
  removeVolumes?: boolean;
};

type OperationSubscriber = (event: StoreOperationEvent) => void;

const operationSubscribers = new Map<string, Set<OperationSubscriber>>();
const latestOperationEvent = new Map<string, StoreOperationEvent>();

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function assertValidPort(port: number) {
  if (!Number.isInteger(port)) {
    throw new Error("webUiPort must be an integer");
  }

  if (port < 1024 || port > 65535) {
    throw new Error("webUiPort must be between 1024 and 65535");
  }
}

function mergeEnv(
  allowedKeys: string[],
  defaults: Record<string, string>,
  existing: Record<string, string>,
  overrides: Record<string, string>,
) {
  const allowed = new Set(allowedKeys);
  const unknownKeys = Object.keys(overrides).filter((key) => !allowed.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(
      `Unsupported env key(s): ${unknownKeys.join(", ")}. Only template-defined env keys are allowed.`,
    );
  }

  const merged: Record<string, string> = {
    ...defaults,
    ...existing,
  };

  for (const [key, value] of Object.entries(overrides)) {
    merged[key] = String(value);
  }

  return merged;
}

function emitEvent(event: StoreOperationEvent) {
  latestOperationEvent.set(event.operationId, event);
  const subscribers = operationSubscribers.get(event.operationId);
  if (!subscribers || subscribers.size === 0) return;

  for (const subscriber of subscribers) {
    subscriber(event);
  }
}

async function patchOperationAndEmit(input: {
  operationId: string;
  appId: string;
  action: StoreOperationAction;
  status: StoreOperationStatus;
  eventType: StoreOperationEvent["type"];
  progressPercent: number;
  step: string;
  message?: string;
  image?: string;
  dockerStatus?: string;
  progressDetail?: StoreOperationEvent["progressDetail"];
  errorMessage?: string | null;
  markStarted?: boolean;
  markFinished?: boolean;
}) {
  const progressPercent = clampPercent(input.progressPercent);

  await updateStoreOperation(input.operationId, {
    status: input.status,
    progressPercent,
    currentStep: input.step,
    errorMessage: input.errorMessage,
    markStarted: input.markStarted,
    markFinished: input.markFinished,
  });

  if (input.eventType !== "operation.pull.progress" || input.status === "error") {
    logServerAction({
      level: input.status === "error" ? "error" : "info",
      layer: "service",
      action: "store.apps.operation",
      status: input.status === "error" ? "error" : "info",
      message: input.message,
      meta: {
        operationId: input.operationId,
        appId: input.appId,
        action: input.action,
        eventType: input.eventType,
        step: input.step,
        progressPercent,
      },
    });
  }

  emitEvent({
    type: input.eventType,
    operationId: input.operationId,
    appId: input.appId,
    action: input.action,
    status: input.status,
    progressPercent,
    step: input.step,
    message: input.message,
    image: input.image,
    dockerStatus: input.dockerStatus,
    progressDetail: input.progressDetail,
    timestamp: new Date().toISOString(),
  });
}

async function runInstallOrRedeployOperation(
  operationId: string,
  params: OperationParams,
  existingStack: InstalledStackConfig | null,
) {
  const template =
    (await findStoreCatalogTemplateByAppId(params.appId)) ??
    (await findCustomStoreTemplateByAppId(params.appId));
  if (!template) {
    throw new Error(`Template not found for appId "${params.appId}"`);
  }

  if (params.action === "redeploy" && !existingStack) {
    throw new Error(`Cannot redeploy "${params.appId}" because it is not installed`);
  }

  const allowedEnvKeys = template.env.map((definition) => definition.name);
  const templateDefaults = Object.fromEntries(
    template.env
      .filter((definition) => typeof definition.default === "string")
      .map((definition) => [definition.name, definition.default as string]),
  );

  const requestedEnv = params.env ?? {};
  const effectiveEnv = mergeEnv(
    allowedEnvKeys,
    templateDefaults,
    existingStack?.env ?? {},
    requestedEnv,
  );

  const requestedPort =
    typeof params.webUiPort === "number" ? params.webUiPort : existingStack?.webUiPort ?? null;

  if (requestedPort !== null) {
    assertValidPort(requestedPort);

    const occupied = await findStackByWebUiPort(requestedPort, {
      excludeAppId: params.appId,
    });
    if (occupied) {
      throw new Error(`webUiPort ${requestedPort} is already used by "${occupied.appId}"`);
    }
  }

  const stackName =
    existingStack?.stackName ?? sanitizeStackName(params.appId, params.displayName ?? template.name);

  await patchOperationAndEmit({
    operationId,
    appId: params.appId,
    action: params.action,
    status: "running",
    eventType: "operation.step",
    progressPercent: 8,
    step: "render",
    message: "Materializing compose files",
  });

  const materialized = isCustomStoreTemplate(template)
    ? await materializeInlineStackFiles({
        appId: params.appId,
        stackName,
        composeContent: template.composeContent,
        env: effectiveEnv,
        webUiPort: requestedPort,
      })
    : await materializeStackFiles({
        appId: params.appId,
        stackName,
        repositoryUrl: template.repositoryUrl,
        stackFile: template.stackFile,
        env: effectiveEnv,
        webUiPort: requestedPort,
      });

  await patchOperationAndEmit({
    operationId,
    appId: params.appId,
    action: params.action,
    status: "running",
    eventType: "operation.step",
    progressPercent: 15,
    step: "pull-images",
    message: "Resolving compose images",
  });

  const images = await extractComposeImages({
    composePath: materialized.composePath,
    envPath: materialized.envPath,
    stackName: materialized.stackName,
  });

  const imageProgress = new Map<string, number>();
  for (const image of images) {
    imageProgress.set(image, 0);
  }

  for (const image of images) {
    await pullDockerImage(image, async (event) => {
      const percentFromDetail = event.progressDetail?.percent;

      let nextPercent = imageProgress.get(image) ?? 0;
      if (typeof percentFromDetail === "number") {
        nextPercent = Math.max(nextPercent, percentFromDetail);
      } else if (event.status.toLowerCase().includes("download complete")) {
        nextPercent = 100;
      }

      imageProgress.set(image, nextPercent);

      const totals = Array.from(imageProgress.values());
      const pullPercent =
        totals.length === 0
          ? 100
          : totals.reduce((accumulator, value) => accumulator + value, 0) / totals.length;
      const operationPercent = 15 + pullPercent * 0.65;

      await patchOperationAndEmit({
        operationId,
        appId: params.appId,
        action: params.action,
        status: "running",
        eventType: "operation.pull.progress",
        progressPercent: operationPercent,
        step: "pull-images",
        image,
        dockerStatus: event.status,
        progressDetail: event.progressDetail,
      });
    });

    imageProgress.set(image, 100);
  }

  await patchOperationAndEmit({
    operationId,
    appId: params.appId,
    action: params.action,
    status: "running",
    eventType: "operation.step",
    progressPercent: 85,
    step: "compose-up",
    message: "Applying docker compose up -d",
  });

  await runComposeUp({
    composePath: materialized.composePath,
    envPath: materialized.envPath,
    stackName: materialized.stackName,
  });

  await patchOperationAndEmit({
    operationId,
    appId: params.appId,
    action: params.action,
    status: "running",
    eventType: "operation.step",
    progressPercent: 95,
    step: "health-check",
    message: "Finalizing deployment",
  });

  await upsertInstalledStack({
    appId: params.appId,
    templateName: template.templateName,
    stackName: materialized.stackName,
    composePath: materialized.composePath,
    status: "installed",
    webUiPort: materialized.webUiPort,
    env: effectiveEnv,
    markInstalledAt: true,
  });
}

async function runUninstallOperation(operationId: string, params: OperationParams) {
  const stack = await findInstalledStackByAppId(params.appId);

  if (!stack || stack.status === "not_installed") {
    await patchOperationAndEmit({
      operationId,
      appId: params.appId,
      action: params.action,
      status: "running",
      eventType: "operation.step",
      progressPercent: 90,
      step: "noop",
      message: "Application already uninstalled",
    });
    return;
  }

  await patchOperationAndEmit({
    operationId,
    appId: params.appId,
    action: params.action,
    status: "running",
    eventType: "operation.step",
    progressPercent: 35,
    step: "compose-down",
    message: "Running docker compose down",
  });

  await runComposeDown({
    composePath: stack.composePath,
    envPath: stack.composePath.replace(/docker-compose\.yml$/, ".env"),
    stackName: stack.stackName,
    removeVolumes: params.removeVolumes,
  });

  await patchOperationAndEmit({
    operationId,
    appId: params.appId,
    action: params.action,
    status: "running",
    eventType: "operation.step",
    progressPercent: 80,
    step: "cleanup",
    message: "Marking stack uninstalled",
  });

  await markStackAsNotInstalled(params.appId);
}

async function executeStoreOperation(operationId: string, params: OperationParams) {
  await patchOperationAndEmit({
    operationId,
    appId: params.appId,
    action: params.action,
    status: "running",
    eventType: "operation.started",
    progressPercent: 1,
    step: "start",
    markStarted: true,
    message: "Operation started",
  });

  try {
    const existingStack = await findInstalledStackByAppId(params.appId);

    if (params.action === "install" || params.action === "redeploy") {
      await runInstallOrRedeployOperation(operationId, params, existingStack);
    } else {
      await runUninstallOperation(operationId, params);
    }

    await patchOperationAndEmit({
      operationId,
      appId: params.appId,
      action: params.action,
      status: "success",
      eventType: "operation.completed",
      progressPercent: 100,
      step: "completed",
      markFinished: true,
      message: "Operation completed",
      errorMessage: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Operation failed";

    await patchOperationAndEmit({
      operationId,
      appId: params.appId,
      action: params.action,
      status: "error",
      eventType: "operation.failed",
      progressPercent: 100,
      step: "failed",
      markFinished: true,
      message,
      errorMessage: message,
    });
  }
}

export async function startStoreOperation(params: OperationParams) {
  const operationId = randomUUID();

  await createStoreOperation({
    id: operationId,
    appId: params.appId,
    action: params.action,
    status: "queued",
    progressPercent: 0,
    currentStep: "queued",
    startedAt: false,
  });

  logServerAction({
    layer: "service",
    action: "store.apps.operation",
    status: "start",
    message: "Queued store operation",
    meta: {
      operationId,
      appId: params.appId,
      action: params.action,
    },
  });

  queueMicrotask(() => {
    void executeStoreOperation(operationId, params);
  });

  return {
    operationId,
  };
}

export async function getStoreOperation(operationId: string): Promise<StoreOperation | null> {
  return findStoreOperationById(operationId);
}

export function getLatestStoreOperationEvent(operationId: string) {
  return latestOperationEvent.get(operationId) ?? null;
}

export function subscribeToStoreOperation(operationId: string, callback: OperationSubscriber) {
  const existing = operationSubscribers.get(operationId) ?? new Set<OperationSubscriber>();
  existing.add(callback);
  operationSubscribers.set(operationId, existing);

  return () => {
    const subscribers = operationSubscribers.get(operationId);
    if (!subscribers) return;

    subscribers.delete(callback);
    if (subscribers.size === 0) {
      operationSubscribers.delete(operationId);
    }
  };
}
