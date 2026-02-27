import "server-only";

import { logServerAction, withServerTiming } from "@/lib/server/logging/logger";
import {
  findStoreCatalogTemplateByAppId,
  listStoreCatalogTemplates,
} from "@/lib/server/modules/store/catalog";
import {
  findCustomStoreTemplateByAppId,
  listCustomStoreTemplates,
} from "@/lib/server/modules/store/custom-apps";
import {
  findInstalledStackByAppId,
  listInstalledStacksFromDb,
} from "@/lib/server/modules/apps/stacks-repository";
import { resolveStoreAppUpdateState } from "@/lib/server/modules/store/update-check";
import type {
  InstalledStackConfig,
  StoreAppDetail,
  StoreAppSummary,
  StoreOperationAction,
} from "@/lib/shared/contracts/apps";
import { startStoreOperation } from "@/lib/server/modules/apps/operations";
import { patchInstalledStackMeta } from "@/lib/server/modules/apps/stacks-repository";

function includesSearch(text: string, search: string) {
  return text.toLowerCase().includes(search.toLowerCase());
}

function toSummary(
  template:
    | Awaited<ReturnType<typeof listStoreCatalogTemplates>>[number]
    | Awaited<ReturnType<typeof listCustomStoreTemplates>>[number],
  installed: Awaited<ReturnType<typeof listInstalledStacksFromDb>>[number] | undefined,
  updateState?: {
    updateAvailable: boolean;
    localDigest: string | null;
    remoteDigest: string | null;
  },
): StoreAppSummary {
  return {
    id: template.appId,
    name: installed?.displayName ?? template.name,
    description: template.description,
    platform: template.platform,
    categories: template.categories,
    logoUrl: installed?.iconUrl ?? template.logoUrl,
    repositoryUrl: template.repositoryUrl,
    stackFile: template.stackFile,
    status: installed?.status ?? "not_installed",
    webUiPort: installed?.webUiPort ?? template.port ?? null,
    updateAvailable: updateState?.updateAvailable ?? false,
    localDigest: updateState?.localDigest ?? null,
    remoteDigest: updateState?.remoteDigest ?? null,
  };
}

async function resolveUpdateState(
  installed: InstalledStackConfig | null | undefined,
): Promise<{
  updateAvailable: boolean;
  localDigest: string | null;
  remoteDigest: string | null;
}> {
  if (!installed || installed.status === "not_installed") {
    return {
      updateAvailable: false,
      localDigest: null,
      remoteDigest: null,
    };
  }

  // Use cached update status from database instead of checking Docker every time
  return {
    updateAvailable: !installed.isUpToDate,
    localDigest: installed.localDigest,
    remoteDigest: installed.remoteDigest,
  };
}

export async function listStoreApps(options?: {
  category?: string;
  search?: string;
  installedOnly?: boolean;
  updatesOnly?: boolean;
}) {
  return withServerTiming(
    {
      layer: "service",
      action: "store.apps.list",
      meta: {
        category: options?.category ?? null,
        search: options?.search ?? null,
        installedOnly: Boolean(options?.installedOnly),
        updatesOnly: Boolean(options?.updatesOnly),
      },
    },
    async () => {
      const [templates, customTemplates, installedStacks] = await Promise.all([
        listStoreCatalogTemplates(),
        listCustomStoreTemplates(),
        listInstalledStacksFromDb(),
      ]);

      const allTemplates = [...templates, ...customTemplates];
      const installedByAppId = new Map(installedStacks.map((item) => [item.appId, item]));
      const updateStateEntries = await Promise.all(
        installedStacks.map(async (stack) => [stack.appId, await resolveUpdateState(stack)] as const),
      );
      const updateStateByAppId = new Map(updateStateEntries);

      let apps = allTemplates
        .map((template) =>
          toSummary(
            template,
            installedByAppId.get(template.appId),
            updateStateByAppId.get(template.appId),
          ),
        )
        .sort((left, right) => left.name.localeCompare(right.name));

      if (options?.category) {
        apps = apps.filter((app) =>
          app.categories.some((category) => category.toLowerCase() === options.category?.toLowerCase()),
        );
      }

      if (options?.search) {
        apps = apps.filter(
          (app) =>
            includesSearch(app.name, options.search as string) ||
            includesSearch(app.description, options.search as string),
        );
      }

      if (options?.installedOnly) {
        apps = apps.filter((app) => app.status !== "not_installed");
      }

      if (options?.updatesOnly) {
        apps = apps.filter((app) => app.updateAvailable);
      }

      return apps;
    },
  );
}

export async function getStoreAppDetail(appId: string): Promise<StoreAppDetail | null> {
  return withServerTiming(
    {
      layer: "service",
      action: "store.apps.detail",
      meta: {
        appId,
      },
    },
    async () => {
      const [template, customTemplate, installedConfig] = await Promise.all([
        findStoreCatalogTemplateByAppId(appId),
        findCustomStoreTemplateByAppId(appId),
        findInstalledStackByAppId(appId),
      ]);

      const sourceTemplate = template ?? customTemplate;
      if (!sourceTemplate) {
        return null;
      }

      const updateState = await resolveUpdateState(installedConfig);

      return {
        ...toSummary(sourceTemplate, installedConfig ?? undefined, updateState),
        note: sourceTemplate.note,
        env: sourceTemplate.env,
        installedConfig,
      };
    },
  );
}

export async function startAppLifecycleAction(input: {
  appId: string;
  action: StoreOperationAction;
  displayName?: string;
  env?: Record<string, string>;
  webUiPort?: number;
  composeSource?: string;
  removeVolumes?: boolean;
}) {
  return withServerTiming(
    {
      layer: "service",
      action: "store.apps.lifecycle",
      meta: {
        appId: input.appId,
        action: input.action,
      },
    },
    async () =>
      startStoreOperation({
        appId: input.appId,
        action: input.action,
        displayName: input.displayName,
        env: input.env,
        webUiPort: input.webUiPort,
        composeSource: input.composeSource,
        removeVolumes: input.removeVolumes,
      }),
  );
}

export async function saveAppSettings(input: {
  appId: string;
  displayName?: string;
  iconUrl?: string | null;
  env?: Record<string, string>;
  webUiPort?: number;
  composeSource?: string;
}): Promise<{ operationId?: string }> {
  return withServerTiming(
    {
      layer: "service",
      action: "store.apps.settings.save",
      meta: {
        appId: input.appId,
        hasEnv: Boolean(input.env),
        hasPort: Boolean(input.webUiPort !== undefined),
      },
    },
    async () => {
      const { appId, displayName, iconUrl, env, webUiPort, composeSource } = input;

      // 1. Always save metadata immediately
      if (displayName !== undefined || iconUrl !== undefined) {
        await patchInstalledStackMeta(appId, { displayName, iconUrl });
      }

      // 2. Trigger redeploy if config changed
      if (env !== undefined || webUiPort !== undefined || composeSource !== undefined) {
        const result = await startStoreOperation({
          appId,
          action: "redeploy",
          env,
          webUiPort,
          composeSource,
        });
        return { operationId: result.operationId };
      }

      return {};
    },
  );
}

export async function checkAllAppsForUpdates() {
  return withServerTiming(
    {
      layer: "service",
      action: "store.apps.check-updates",
    },
    async () => {
      const installed = await listInstalledStacksFromDb();
      const results: Array<{
        appId: string;
        updateAvailable: boolean;
        localDigest: string | null;
        remoteDigest: string | null;
      }> = [];

      for (const app of installed) {
        if (app.status === "not_installed") {
          continue;
        }

        try {
          const updateState = await resolveStoreAppUpdateState({
            composePath: app.composePath,
            stackName: app.stackName,
          });

          // Update DB with fresh check results
          const { updateStackUpdateStatus } = await import("@/lib/server/modules/apps/stacks-repository");
          await updateStackUpdateStatus({
            appId: app.appId,
            isUpToDate: !updateState.updateAvailable,
            localDigest: updateState.localDigest,
            remoteDigest: updateState.remoteDigest,
          });

          results.push({
            appId: app.appId,
            updateAvailable: updateState.updateAvailable,
            localDigest: updateState.localDigest,
            remoteDigest: updateState.remoteDigest,
          });
        } catch (error) {
          logServerAction({
            level: "warn",
            layer: "service",
            action: "store.apps.check-updates.app",
            status: "error",
            message: "Failed to check updates for app",
            meta: { appId: app.appId },
            error,
          });
        }
      }

      return results;
    },
  );
}
