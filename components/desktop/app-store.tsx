"use client";

import {
  AlertCircle,
  ArrowUpCircle,
  CheckCircle2,
  Download,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AppSettingsPanel } from "@/components/desktop/app-settings-panel";
import { AppStoreInstallMenu } from "@/components/desktop/app-store-install-menu";
import {
  CustomAppInstallDialog,
  type CustomAppInstallDialogInput,
} from "@/components/desktop/custom-app-install-dialog";
import { UninstallAppDialog } from "@/components/desktop/uninstall-app-dialog";
import { useStoreActions } from "@/hooks/useStoreActions";
import { useStoreApp } from "@/hooks/useStoreApp";
import { useStoreCatalog } from "@/hooks/useStoreCatalog";
import { useStoreOperation } from "@/hooks/useStoreOperation";
import type { AppActionTarget } from "@/components/desktop/app-grid";
import type { AppOperationState } from "@/hooks/useStoreActions";
import type { StoreAppDetail, StoreAppSummary } from "@/lib/shared/contracts/apps";

function operationLabel(operation: AppOperationState | undefined) {
  if (!operation) return null;

  if (operation.status === "queued") return "Queued";
  if (operation.status === "running") {
    if (operation.action === "install") return "Installing";
    if (operation.action === "redeploy") return "Redeploying";
    return "Uninstalling";
  }

  if (operation.status === "success") return "Completed";
  return "Failed";
}

function isOperationBusy(operation: AppOperationState | undefined) {
  return Boolean(operation && (operation.status === "queued" || operation.status === "running"));
}

function StatusBadge({
  app,
  operation,
}: {
  app: StoreAppSummary;
  operation?: AppOperationState;
}) {
  if (operation) {
    if (operation.status === "error") {
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-status-red">
          <AlertCircle className="size-3" /> Failed
        </span>
      );
    }

    if (operation.status === "success") {
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-status-green">
          <CheckCircle2 className="size-3" /> Completed
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1 text-xs font-medium text-primary animate-pulse">
        <Loader2 className="size-3 animate-spin" /> {operationLabel(operation)}...
      </span>
    );
  }

  if (app.status === "installed") {
    if (app.updateAvailable) {
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-primary">
          <ArrowUpCircle className="size-3" /> Update available
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1 text-xs font-medium text-status-green">
        <CheckCircle2 className="size-3" /> Installed
      </span>
    );
  }

  if (app.status === "error") {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-status-red">
        <AlertCircle className="size-3" /> Error
      </span>
    );
  }

  return <span className="text-xs text-muted-foreground">Not installed</span>;
}

function StoreLogo({
  logoUrl,
  alt,
  className,
  fallbackLabel,
}: {
  logoUrl: string | null;
  alt: string;
  className: string;
  fallbackLabel: string;
}) {
  const [failed, setFailed] = useState(false);

  if (logoUrl && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt={alt} className={className} onError={() => setFailed(true)} />;
  }

  return <Package className={`${className} text-muted-foreground`} aria-label={fallbackLabel} />;
}

type AppStoreDetailPanelProps = {
  app: StoreAppSummary | null;
  detail: StoreAppDetail | null | undefined;
  isLoading: boolean;
  operation?: AppOperationState;
  actionError: string | null;
  onBack: () => void;
  onInstall: () => void;
  onUpdate: () => void;
  onRedeploy: () => void;
  onUninstall: () => void;
  onCustomInstall: () => void;
};

function AppStoreDetailPanel({
  app,
  detail,
  isLoading,
  operation,
  actionError,
  onBack,
  onInstall,
  onUpdate,
  onRedeploy,
  onUninstall,
  onCustomInstall,
}: AppStoreDetailPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-glass-border shrink-0">
        <button
          onClick={onBack}
          className="text-xs text-primary hover:underline cursor-pointer"
        >
          {"< Back to Store"}
        </button>
      </div>

      {!app || isLoading ? (
        <div className="flex-1 p-6 text-sm text-muted-foreground">Loading app details...</div>
      ) : !detail ? (
        <div className="flex-1 p-6 text-sm text-status-red">App details are unavailable.</div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-start gap-5">
            <div className="size-20 rounded-3xl bg-glass border border-glass-border flex items-center justify-center overflow-hidden">
              <StoreLogo
                logoUrl={detail.logoUrl}
                alt={`${detail.name} logo`}
                className="size-12 object-contain"
                fallbackLabel="app-logo-fallback-detail"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-foreground">{detail.name}</h2>
              <p className="text-xs text-muted-foreground mt-1">{detail.description}</p>
              <div className="mt-3">
                <StatusBadge app={detail} operation={operation} />
              </div>
              {operation ? (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {operation.step} • {operation.progressPercent}%
                  </p>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.max(2, operation.progressPercent)}%` }}
                    />
                  </div>
                  {operation.message ? (
                    <p className="text-xs text-status-red">{operation.message}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-glass border border-glass-border text-xs text-muted-foreground">
            {detail.note}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="p-3 rounded-xl bg-glass border border-glass-border">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Platform</p>
              <p className="mt-1 text-xs text-foreground font-medium">{detail.platform}</p>
            </div>
            <div className="p-3 rounded-xl bg-glass border border-glass-border">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Repository URL</p>
              {detail.repositoryUrl.startsWith("http://") || detail.repositoryUrl.startsWith("https://") ? (
                <a
                  href={detail.repositoryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block text-xs text-primary hover:underline break-all"
                >
                  {detail.repositoryUrl}
                </a>
              ) : (
                <p className="mt-1 text-xs text-foreground break-all">{detail.repositoryUrl}</p>
              )}
            </div>
          </div>

          {actionError ? <p className="text-xs text-status-red">{actionError}</p> : null}

          <div className="flex items-center gap-2">
            {detail.status === "not_installed" ? (
              <button
                onClick={onInstall}
                disabled={isOperationBusy(operation)}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:brightness-110 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Download className="size-3.5" /> Install
              </button>
            ) : (
              <>
                {detail.updateAvailable ? (
                  <button
                    onClick={onUpdate}
                    disabled={isOperationBusy(operation)}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:brightness-110 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <ArrowUpCircle className="size-3.5" /> Update
                  </button>
                ) : (
                  <button
                    onClick={onRedeploy}
                    disabled={isOperationBusy(operation)}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:brightness-110 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className="size-3.5" /> Redeploy
                  </button>
                )}
                <button
                  onClick={onUninstall}
                  disabled={isOperationBusy(operation)}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-status-red/15 text-status-red rounded-lg hover:bg-status-red/25 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Trash2 className="size-3.5" /> Uninstall
                </button>
              </>
            )}
            <button
              onClick={onCustomInstall}
              disabled={isOperationBusy(operation)}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium border border-glass-border text-foreground rounded-lg hover:bg-secondary/40 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Wrench className="size-3.5" /> Custom Install
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AppStore() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "installed">("all");
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customActionError, setCustomActionError] = useState<string | null>(null);
  const [customInstallPending, setCustomInstallPending] = useState(false);
  const [customInstallTemplate, setCustomInstallTemplate] = useState<StoreAppDetail | null>(null);
  const [uninstallDialogApp, setUninstallDialogApp] = useState<StoreAppSummary | null>(null);
  const [uninstallError, setUninstallError] = useState<string | null>(null);
  const [uninstallPending, setUninstallPending] = useState(false);

  const {
    operationsByApp,
    installApp,
    installCustomApp,
    redeployApp,
    uninstallApp,
  } = useStoreActions();

  const catalogQuery = useStoreCatalog({
    search: search.trim() || undefined,
    installedOnly: filter === "installed",
  });

  const apps = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);

  const selectedSummary = useMemo(
    () => apps.find((app) => app.id === selectedAppId) ?? null,
    [apps, selectedAppId],
  );
  const detailQuery = useStoreApp(selectedAppId);
  const selectedDetail = detailQuery.data;

  const selectedOperationId =
    selectedAppId && operationsByApp[selectedAppId]
      ? operationsByApp[selectedAppId].operationId
      : null;
  const selectedOperationQuery = useStoreOperation(selectedOperationId);
  const selectedOperation =
    (selectedAppId ? operationsByApp[selectedAppId] : undefined) ??
    (selectedOperationQuery.operation
      ? {
          operationId: selectedOperationQuery.operation.id,
          appId: selectedOperationQuery.operation.appId,
          action: selectedOperationQuery.operation.action,
          status: selectedOperationQuery.operation.status,
          progressPercent: selectedOperationQuery.operation.progressPercent,
          step: selectedOperationQuery.operation.currentStep,
          message: selectedOperationQuery.operation.errorMessage,
        }
      : undefined);

  const installedCount = apps.filter((app) => app.status !== "not_installed").length;

  async function startInstall(app: StoreAppSummary) {
    setActionError(null);

    try {
      await installApp({
        appId: app.id,
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to start install.");
    }
  }

  async function startRedeploy(app: StoreAppSummary) {
    setActionError(null);

    try {
      await redeployApp({
        appId: app.id,
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to start redeploy.");
    }
  }

  async function startUninstall(app: StoreAppSummary) {
    setActionError(null);
    setUninstallError(null);
    setUninstallDialogApp(app);
  }

  async function submitDetailAction(action: "install" | "update" | "redeploy" | "uninstall") {
    if (!selectedSummary || !selectedDetail) return;
    setActionError(null);

    try {
      if (action === "uninstall") {
        setUninstallError(null);
        setUninstallDialogApp(selectedSummary);
        return;
      }

      if (action === "install") {
        await installApp({
          appId: selectedSummary.id,
        });
        return;
      }

      await redeployApp({
        appId: selectedSummary.id,
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Request failed.");
    }
  }

  async function startCustomInstall(input: CustomAppInstallDialogInput) {
    setCustomActionError(null);
    setCustomInstallPending(true);

    try {
      await installCustomApp(input);
      setCustomDialogOpen(false);
    } catch (error) {
      setCustomActionError(error instanceof Error ? error.message : "Unable to install custom app.");
      throw error;
    } finally {
      setCustomInstallPending(false);
    }
  }

  async function confirmUninstall(input: { deleteData: boolean }) {
    if (!uninstallDialogApp) return;

    setUninstallError(null);
    setUninstallPending(true);

    try {
      await uninstallApp({
        appId: uninstallDialogApp.id,
        removeVolumes: input.deleteData,
      });
      setUninstallDialogApp(null);
    } catch (error) {
      setUninstallError(error instanceof Error ? error.message : "Unable to start uninstall.");
    } finally {
      setUninstallPending(false);
    }
  }

  const uninstallDialog = (
    <UninstallAppDialog
      open={Boolean(uninstallDialogApp)}
      appName={uninstallDialogApp?.name ?? null}
      isSubmitting={uninstallPending}
      error={uninstallError}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setUninstallDialogApp(null);
          setUninstallError(null);
        }
      }}
      onConfirm={confirmUninstall}
    />
  );

  function openCustomInstallSettings() {
    if (!selectedDetail) return;
    setCustomInstallTemplate(selectedDetail);
  }

  if (selectedAppId) {
    return (
      <div className="relative h-full">
        <AppStoreDetailPanel
          app={selectedSummary}
          detail={selectedDetail}
          isLoading={detailQuery.isLoading}
          operation={selectedOperation}
          actionError={actionError}
          onBack={() => setSelectedAppId(null)}
          onInstall={() => void submitDetailAction("install")}
          onUpdate={() => void submitDetailAction("update")}
          onRedeploy={() => void submitDetailAction("redeploy")}
          onUninstall={() => void submitDetailAction("uninstall")}
          onCustomInstall={openCustomInstallSettings}
        />
        {customInstallTemplate ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
            <div className="relative h-[min(92vh,760px)] w-[min(96vw,980px)] overflow-hidden rounded-2xl border border-glass-border bg-card shadow-2xl">
              <button
                type="button"
                aria-label="Close install settings"
                onClick={() => setCustomInstallTemplate(null)}
                className="absolute right-3 top-3 z-30 rounded-md border border-glass-border bg-card/90 px-2 py-1 text-xs text-foreground hover:bg-secondary/40 cursor-pointer"
              >
                Close
              </button>
              <AppSettingsPanel
                template={customInstallTemplate}
                onClose={() => setCustomInstallTemplate(null)}
              />
            </div>
          </div>
        ) : null}
        {uninstallDialog}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-glass-border shrink-0">
        <div className="flex items-center gap-1 bg-glass rounded-lg p-0.5">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              filter === "all"
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All Apps
          </button>
          <button
            onClick={() => setFilter("installed")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              filter === "installed"
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Installed ({installedCount})
          </button>
        </div>

        <div className="flex-1" />

        <AppStoreInstallMenu onInstallCustomClick={() => setCustomDialogOpen(true)} />

        <div className="relative w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search apps..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-glass border border-glass-border rounded-lg text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/40 transition-colors"
          />
        </div>
      </div>

      <CustomAppInstallDialog
        open={customDialogOpen}
        onOpenChange={(nextOpen) => {
          setCustomDialogOpen(nextOpen);
          if (!nextOpen) {
            setCustomActionError(null);
          }
        }}
        onSubmit={startCustomInstall}
        isSubmitting={customInstallPending}
        error={customActionError}
      />
      {uninstallDialog}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4">
          {actionError ? (
            <div className="mb-3 rounded-lg border border-status-red/30 bg-status-red/10 px-3 py-2 text-xs text-status-red">
              {actionError}
            </div>
          ) : null}

          {catalogQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading app catalog...</div>
          ) : catalogQuery.isError ? (
            <div className="text-sm text-status-red">Unable to load app catalog.</div>
          ) : apps.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <Search className="size-8 opacity-30" />
              <span className="text-sm">No apps found</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {apps.map((app) => {
                const operation = operationsByApp[app.id];
                const busy = isOperationBusy(operation);

                return (
                  <div
                    key={app.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedAppId(app.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedAppId(app.id);
                      }
                    }}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/40 border border-transparent hover:border-glass-border transition-all cursor-pointer text-left"
                  >
                    <div className="size-12 rounded-2xl bg-glass border border-glass-border flex items-center justify-center overflow-hidden shrink-0">
                      <StoreLogo
                        logoUrl={app.logoUrl}
                        alt={`${app.name} logo`}
                        className="size-7 object-contain"
                        fallbackLabel="app-logo-fallback"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{app.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {app.description}
                      </p>
                      {operation ? (
                        <div className="mt-1">
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${Math.max(2, operation.progressPercent)}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {operation.step} • {operation.progressPercent}%
                          </p>
                        </div>
                      ) : null}
                    </div>

                    <div
                      className="shrink-0 flex flex-col items-end gap-1.5"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <StatusBadge app={app} operation={operation} />
                      {app.status === "not_installed" ? (
                        <button
                          onClick={() => void startInstall(app)}
                          disabled={busy}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-primary/15 text-primary rounded-md hover:bg-primary/25 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <Download className="size-3" /> Install
                        </button>
                      ) : (
                        <div className="flex items-center gap-1">
                          {app.updateAvailable ? (
                            <button
                              onClick={() => void startRedeploy(app)}
                              disabled={busy}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-primary/15 text-primary rounded-md hover:bg-primary/25 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <ArrowUpCircle className="size-3" /> Update
                            </button>
                          ) : (
                            <button
                              onClick={() => void startRedeploy(app)}
                              disabled={busy}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-primary/15 text-primary rounded-md hover:bg-primary/25 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <RefreshCw className="size-3" />
                            </button>
                          )}
                          <button
                            onClick={() => void startUninstall(app)}
                            disabled={busy}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-status-red/15 text-status-red rounded-md hover:bg-status-red/25 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
