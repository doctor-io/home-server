"use client";

import type { AppActionTarget } from "@/components/desktop/app-grid";
import { ClassicFormView } from "@/components/desktop/apps/classic-form-view";
import { ComposeEditorView } from "@/components/desktop/apps/compose-editor-view";
import { ConfiguratorHeader } from "@/components/desktop/apps/configurator-header";
import {
  buildInitialComposeDraft,
  buildInitialDockerRunState,
  buildInstallPayloadFromClassic,
  buildSettingsPayloadFromClassic,
  classicStateToCompose,
  createDefaultClassicState,
  safeComposeToClassicState,
  toAppId,
  type ClassicConfigState,
  type ConfiguratorView,
  type DockerRunState,
} from "@/components/desktop/apps/configurator-mapper";
import { DockerRunView } from "@/components/desktop/apps/docker-run-view";
import { useAppCompose } from "@/hooks/useAppCompose";
import { useStoreActions } from "@/hooks/useStoreActions";
import { useStoreApp } from "@/hooks/useStoreApp";
import type { StoreAppDetail } from "@/lib/shared/contracts/apps";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export type AppConfiguratorContext =
  | "installed_edit"
  | "catalog_install"
  | "custom_install";

export type AppConfiguratorPanelProps = {
  context: AppConfiguratorContext;
  target?: AppActionTarget;
  template?: StoreAppDetail;
  customDefaults?: {
    name?: string;
    iconUrl?: string;
  };
  onClose?: () => void;
};

function parseDashboardUrl(input: string | undefined) {
  if (!input) {
    return {
      host: "localhost",
      port: undefined as number | undefined,
    };
  }

  try {
    const parsed = new URL(input);
    return {
      host: parsed.hostname || "localhost",
      port: parsed.port ? Number.parseInt(parsed.port, 10) : undefined,
    };
  } catch {
    return {
      host: "localhost",
      port: undefined as number | undefined,
    };
  }
}

function parsePort(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) return undefined;
  return parsed;
}

function parseRunPort(value: string) {
  const parsed = parsePort(value);
  return parsed;
}

function defaultViewForContext(context: AppConfiguratorContext): ConfiguratorView {
  if (context === "custom_install") return "docker_run";
  return "classic";
}

function titleForContext(context: AppConfiguratorContext, currentTitle: string) {
  if (context === "installed_edit") return `${currentTitle || "App"} Settings`;
  if (context === "catalog_install") return `Install ${currentTitle || "App"}`;
  return "Install Custom App";
}

export function AppConfiguratorPanel({
  context,
  target,
  template,
  customDefaults,
  onClose,
}: AppConfiguratorPanelProps) {
  const derivedTargetAppId = target
    ? target.appId || toAppId(target.appName)
    : undefined;
  const queryAppId =
    context === "custom_install"
      ? null
      : template?.id ?? derivedTargetAppId ?? null;

  const detailQuery = useStoreApp(queryAppId);
  const fetchedDetail = (detailQuery.data ?? undefined) || undefined;

  const effectiveTemplate = useMemo(() => {
    if (context === "catalog_install") {
      return template ?? fetchedDetail;
    }

    if (context === "installed_edit") {
      return fetchedDetail ?? template;
    }

    return undefined;
  }, [context, fetchedDetail, template]);

  const composeSource = context === "installed_edit" ? "installed" : "catalog";
  const shouldFetchCompose = Boolean(queryAppId && context !== "custom_install");
  const composeQuery = useAppCompose(
    queryAppId ?? undefined,
    shouldFetchCompose,
    composeSource,
  );
  const composeResponse = composeQuery.data;
  const composeData = composeResponse?.primary;
  const primaryServiceName = composeResponse?.primaryServiceName;

  const dashboard = parseDashboardUrl(target?.dashboardUrl);
  const seedTitle =
    effectiveTemplate?.installedConfig?.displayName ??
    effectiveTemplate?.name ??
    target?.appName ??
    customDefaults?.name ??
    "";
  const seedIconUrl =
    effectiveTemplate?.installedConfig?.iconUrl ??
    effectiveTemplate?.logoUrl ??
    customDefaults?.iconUrl ??
    "";
  const seedPort = effectiveTemplate?.webUiPort ?? dashboard.port;
  const seedHost = dashboard.host;

  const fallbackAppId = toAppId(seedTitle || "custom-app") || "custom-app";
  const appId = queryAppId ?? fallbackAppId;

  const initialComposeDraft = useMemo(
    () =>
      composeResponse?.compose ??
      buildInitialComposeDraft({
        appId,
        template: effectiveTemplate,
        composeData,
        dockerImageFallback: `${appId}/${appId}:latest`,
      }),
    [appId, composeData, composeResponse?.compose, effectiveTemplate],
  );

  const initialParsed = useMemo(
    () =>
      safeComposeToClassicState({
        composeDraft: initialComposeDraft,
        seed: {
          title: seedTitle,
          iconUrl: seedIconUrl,
          fallbackPort: seedPort,
          fallbackHost: seedHost,
        },
        appId,
        primaryServiceName,
      }),
    [appId, initialComposeDraft, primaryServiceName, seedHost, seedIconUrl, seedPort, seedTitle],
  );

  const initialClassicState: ClassicConfigState =
    initialParsed.state ??
    createDefaultClassicState({
      title: seedTitle,
      iconUrl: seedIconUrl,
      fallbackPort: seedPort,
      fallbackHost: seedHost,
    });

  const initialDockerRunState = useMemo(
    () =>
      buildInitialDockerRunState({
        title: initialClassicState.title || "my-app",
        iconUrl: initialClassicState.iconUrl,
        port: initialClassicState.webUi.port,
      }),
    [initialClassicState.iconUrl, initialClassicState.title, initialClassicState.webUi.port],
  );

  const [activeView, setActiveView] = useState<ConfiguratorView>(
    defaultViewForContext(context),
  );
  const [classicState, setClassicState] = useState<ClassicConfigState>(
    initialClassicState,
  );
  const [composeDraft, setComposeDraft] = useState(initialComposeDraft);
  const [composeParseError, setComposeParseError] = useState<string | null>(
    initialParsed.error,
  );
  const [dockerRunState, setDockerRunState] = useState<DockerRunState>(
    initialDockerRunState,
  );
  const [didSave, setDidSave] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const initialClassicRef = useRef<ClassicConfigState>(initialClassicState);
  const { saveAppSettings, installApp, installCustomApp } = useStoreActions();

  useEffect(() => {
    setActiveView(defaultViewForContext(context));
    setClassicState(initialClassicState);
    setComposeDraft(initialComposeDraft);
    setComposeParseError(initialParsed.error);
    setDockerRunState(initialDockerRunState);
    setDidSave(false);
    setSaveError(null);
    initialClassicRef.current = initialClassicState;
  }, [
    context,
    initialClassicState,
    initialComposeDraft,
    initialDockerRunState,
    initialParsed.error,
  ]);

  const availableViews = useMemo<ConfiguratorView[]>(() => {
    if (context === "custom_install") {
      return ["classic", "compose", "docker_run"];
    }

    return ["classic", "compose"];
  }, [context]);

  useEffect(() => {
    if (availableViews.includes(activeView)) return;
    setActiveView(availableViews[0]);
  }, [activeView, availableViews]);

  function handleClassicChange(nextState: ClassicConfigState) {
    setDidSave(false);
    setSaveError(null);
    setClassicState(nextState);
    setComposeDraft((previousDraft) =>
      classicStateToCompose(nextState, previousDraft, {
        appId,
        primaryServiceName,
      }),
    );
    setComposeParseError(null);
  }

  function handleComposeChange(nextDraft: string) {
    setDidSave(false);
    setSaveError(null);
    setComposeDraft(nextDraft);

    const parsed = safeComposeToClassicState({
      composeDraft: nextDraft,
      seed: {
        title: classicState.title,
        iconUrl: classicState.iconUrl,
        fallbackPort: seedPort,
        fallbackHost: seedHost,
      },
      appId,
      primaryServiceName,
    });

    if (parsed.state) {
      setClassicState(parsed.state);
      setComposeParseError(null);
      return;
    }

    setComposeParseError(parsed.error);
  }

  const title = titleForContext(context, classicState.title || seedTitle);
  const buttonLabel =
    context === "installed_edit"
      ? isSaving
        ? "Saving..."
        : "Save"
      : isSaving
        ? "Installing..."
        : "Install";

  const composeCanSubmit =
    composeDraft.trim().length > 0 &&
    !composeParseError &&
    (context !== "catalog_install" || Boolean(queryAppId));
  const dockerRunCanSubmit =
    dockerRunState.name.trim().length > 0 && dockerRunState.source.trim().length > 0;
  const canSubmit =
    activeView === "docker_run" ? dockerRunCanSubmit : composeCanSubmit;
  const shouldBlockOnTemplateLoading =
    context === "catalog_install" && !effectiveTemplate && detailQuery.isLoading;

  async function handleSubmit() {
    if (isSaving || !canSubmit) return;

    setIsSaving(true);
    setDidSave(false);
    setSaveError(null);

    try {
      if (context === "installed_edit") {
        if (!queryAppId) throw new Error("App ID is required for settings");

        await saveAppSettings(
          buildSettingsPayloadFromClassic({
            appId: queryAppId,
            current: classicState,
            initial: initialClassicRef.current,
            composeSource: composeDraft,
          }),
        );
      } else if (context === "catalog_install") {
        if (!queryAppId) throw new Error("App ID is required for install");

        await installApp(
          buildInstallPayloadFromClassic({
            appId: queryAppId,
            state: classicState,
            composeSource: composeDraft,
          }),
        );
      } else if (activeView === "docker_run") {
        await installCustomApp({
          name: dockerRunState.name.trim(),
          iconUrl: dockerRunState.iconUrl.trim() || undefined,
          webUiPort: parseRunPort(dockerRunState.webUiPort),
          repositoryUrl: dockerRunState.repositoryUrl.trim() || undefined,
          sourceType: "docker-run",
          source: dockerRunState.source,
        });
      } else {
        await installCustomApp({
          name: classicState.title.trim() || "Custom App",
          iconUrl: classicState.iconUrl.trim() || undefined,
          webUiPort: parsePort(classicState.webUi.port),
          sourceType: "docker-compose",
          source: composeDraft,
        });
      }

      setDidSave(true);
      onClose?.();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to submit app configuration.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-card/90">
      <ConfiguratorHeader
        title={title}
        activeView={activeView}
        views={availableViews}
        onViewChange={setActiveView}
      />

      {shouldBlockOnTemplateLoading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Loading app configuration...
        </div>
      ) : (
        <>
          {context === "installed_edit" && composeQuery.isError ? (
            <div className="mx-6 mt-4 rounded-lg border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red">
              {String(composeQuery.error).includes("installed_compose_missing")
                ? "Installed compose file is unavailable for this app."
                : "Unable to load compose source for this app."}
            </div>
          ) : null}

          {context !== "custom_install" && !effectiveTemplate ? (
            <div className="mx-6 mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              App template metadata is unavailable. You can still edit and submit manually.
            </div>
          ) : null}

          {activeView === "classic" ? (
            <ClassicFormView
              appIdLabel={queryAppId ?? appId}
              state={classicState}
              onChange={handleClassicChange}
            />
          ) : null}

          {activeView === "compose" ? (
            <ComposeEditorView
              composeDraft={composeDraft}
              onChange={handleComposeChange}
              parseError={composeParseError}
            />
          ) : null}

          {activeView === "docker_run" && context === "custom_install" ? (
            <DockerRunView
              state={dockerRunState}
              onChange={(nextState) => {
                setDidSave(false);
                setSaveError(null);
                setDockerRunState(nextState);
              }}
            />
          ) : null}
        </>
      )}

      <footer className="flex items-center justify-between border-t border-glass-border px-6 py-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {didSave
              ? context === "installed_edit"
                ? "Saved successfully"
                : "Installation started"
              : context === "installed_edit"
                ? "Changes are local for now"
                : "Configure settings before installing"}
          </span>
          {saveError ? <span className="text-xs text-status-red">{saveError}</span> : null}
        </div>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={isSaving || !canSubmit}
          className="flex items-center gap-2 rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
          {buttonLabel}
        </button>
      </footer>
    </div>
  );
}
