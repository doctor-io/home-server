"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type {
  StoreAppDetail,
  StoreAppSummary,
} from "@/lib/shared/contracts/apps";
import { queryKeys } from "@/lib/shared/query-keys";
import {
  getStoreOperationLabel,
  isStoreOperationActiveStatus,
} from "@/lib/shared/store-operations";
import { AppStoreInstallMenu } from "@/modules/apps/components/app-store-install-menu";
import { AppStoreSourcesDialog } from "@/modules/apps/components/app-store-sources-dialog";
import { AppConfiguratorPanel } from "@/modules/apps/components/configurator/app-configurator-panel";
import { UninstallAppDialog } from "@/modules/apps/components/uninstall-app-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useInstalledApps } from "@/modules/apps/hooks/useInstalledApps";
import type { AppOperationState } from "@/modules/apps/hooks/useStoreActions";
import { useStoreActions } from "@/modules/apps/hooks/useStoreActions";
import { useStoreApp } from "@/modules/apps/hooks/useStoreApp";
import { useStoreCatalog } from "@/modules/apps/hooks/useStoreCatalog";
import { useStoreOperation } from "@/modules/apps/hooks/useStoreOperation";
import {
  useStoreSourceActions,
  useStoreSources,
} from "@/modules/apps/hooks/useStoreSources";
import {
  AlertCircle,
  ArrowUpCircle,
  CheckCircle2,
  Download,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Trash2,
  Wrench,
} from "@/components/icons/platform-icons";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

const STORE_PAGE_SIZE = 24;
const STORE_SECTION_CARD_LIMIT = 6;
const STORE_PANEL_SHELL =
  "rounded-[calc(var(--radius)+0.375rem)] border border-glass-border bg-card/78 shadow-sm backdrop-blur-xl";
const STORE_PANEL_INSET =
  "rounded-[calc(var(--radius)+0.125rem)] border border-glass-border/80 bg-background/42";
const STORE_BADGE_SURFACE =
  "rounded-[var(--radius)] border border-glass-border bg-background/55";

function isOperationBusy(operation: AppOperationState | undefined) {
  return Boolean(operation && isStoreOperationActiveStatus(operation.status));
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
        <Loader2 className="size-3 animate-spin" />{" "}
        {getStoreOperationLabel(operation)}...
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

function SourceBadge({
  sourceName,
  sourceKind,
}: Pick<StoreAppSummary, "sourceName" | "sourceKind">) {
  return (
    <span
      className={`rounded-[var(--radius)] border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.18em] ${
        sourceKind === "official"
          ? "border-primary/25 text-primary"
          : sourceKind === "custom"
            ? "border-status-yellow/25 text-status-yellow"
            : "border-glass-border text-muted-foreground"
      }`}
    >
      {sourceName}
    </span>
  );
}


/** Compare two image tags as dot-separated numeric versions. Returns >0 if a > b. */
function compareImageTags(a: string, b: string): number {
  const pa = a.split(".").map((s) => parseInt(s, 10) || 0);
  const pb = b.split(".").map((s) => parseInt(s, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function extractImageTag(image: string | null | undefined): string | null {
  if (!image) return null;
  const lastSlash = image.lastIndexOf("/");
  const lastColon = image.lastIndexOf(":");
  if (lastColon > lastSlash) return image.slice(lastColon + 1) || null;
  return null;
}

function buildUpdateTitle(app: StoreAppSummary) {
  if (!app.updateAvailable) {
    return undefined;
  }

  const currentTag = extractImageTag(app.installedImage);
  const availableTag = extractImageTag(app.image);

  // Only show the Available image/tag when the catalog tag is strictly newer.
  const catalogIsNewer =
    currentTag !== null &&
    availableTag !== null &&
    compareImageTags(availableTag, currentTag) > 0;

  if (!catalogIsNewer) {
    return undefined;
  }

  const lines: string[] = [];

  if (app.installedImage) lines.push(`Current image: ${app.installedImage}`);
  if (currentTag) lines.push(`Current tag: ${currentTag}`);
  if (app.image) lines.push(`Available image: ${app.image}`);
  if (availableTag) lines.push(`Available tag: ${availableTag}`);

  return lines.length > 0 ? lines.join("\n") : undefined;
}

function buildUpdateTooltipLines(app: StoreAppSummary) {
  const title = buildUpdateTitle(app);
  return title ? title.split("\n") : [];
}

function UpdateInfoTooltip({
  app,
  children,
}: {
  app: StoreAppSummary;
  children: ReactNode;
}) {
  const lines = buildUpdateTooltipLines(app);

  if (lines.length === 0) {
    return children;
  }

  return (
    <Tooltip delayDuration={120}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="top"
        align="end"
        className="max-w-[26rem] rounded-[calc(var(--radius)+0.125rem)] border border-glass-border bg-card/96 px-3 py-2 text-left text-[11px] leading-5 text-foreground shadow-xl backdrop-blur-xl"
      >
        <div className="space-y-0.5">
          {lines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
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
    return (
      // eslint-disable-next-line @next/next/no-img-element -- dynamic external URL from app catalog; remotePatterns cannot enumerate all sources
      <img
        src={logoUrl}
        alt={alt}
        className={className}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <Package
      className={`${className} text-muted-foreground`}
      aria-label={fallbackLabel}
    />
  );
}

type CatalogCategory = {
  id: string;
  name: string;
  description: string;
  appCount: number;
};

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
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-glass-border/80 px-5 py-3">
        <button
          onClick={onBack}
          className="text-xs text-primary hover:underline cursor-pointer"
        >
          {"< Back to Store"}
        </button>
      </div>

      {!app || isLoading ? (
        <div className="flex-1 p-6 text-sm text-muted-foreground">
          Loading app details...
        </div>
      ) : !detail ? (
        <div className="flex-1 p-6 text-sm text-status-red">
          App details are unavailable.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-start gap-5">
            <div className="flex size-20 items-center justify-center overflow-hidden rounded-[calc(var(--radius)+0.75rem)] border border-glass-border bg-card/80 shadow-sm">
              <StoreLogo
                logoUrl={detail.logoUrl}
                alt={`${detail.name} logo`}
                className="size-12 object-contain"
                fallbackLabel="app-logo-fallback-detail"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-foreground">
                  {detail.name}
                </h2>
                {detail.categories.map((category) => (
                  <span
                    key={category}
                    className={`${STORE_BADGE_SURFACE} px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground`}
                  >
                    {category}
                  </span>
                ))}
              </div>

              <div className="mt-3">
                <StatusBadge app={detail} operation={operation} />
              </div>
              <div className="mt-2">
                <SourceBadge
                  sourceName={detail.sourceName}
                  sourceKind={detail.sourceKind}
                />
              </div>
              {operation ? (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {operation.step} • {operation.progressPercent}%
                  </p>
                  <div className="h-1.5 overflow-hidden rounded-[var(--radius)] bg-muted">
                    <div
                      className="h-full rounded-[var(--radius)] bg-primary transition-all"
                      style={{
                        width: `${Math.max(2, operation.progressPercent)}%`,
                      }}
                    />
                  </div>
                  {operation.message ? (
                    <p className="text-xs text-status-red">
                      {operation.message}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className={`${STORE_PANEL_INSET} p-4 text-xs leading-5 text-muted-foreground`}>
            {detail.note}
          </div>

          {detail.screenshots.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Screenshots
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Swipe or scroll
                </p>
              </div>
              <div className="-mx-1 overflow-x-auto px-1 pb-2">
                <div className="flex snap-x snap-mandatory gap-3">
                  {detail.screenshots.slice(0, 4).map((screenshot, index) => (
                    <div
                      key={`${screenshot}-${index}`}
                      className="min-w-[min(100%,18rem)] sm:min-w-[20rem] md:min-w-[24rem] snap-start overflow-hidden rounded-[calc(var(--radius)+0.5rem)] border border-glass-border bg-card/82 shadow-sm"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- dynamic external screenshot URL from app catalog */}
                      <img
                        src={screenshot}
                        alt={`${detail.name} screenshot ${index + 1}`}
                        className="h-44 w-full object-cover sm:h-52 md:h-56"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className={`${STORE_PANEL_INSET} p-3`}>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Platform
              </p>
              <p className="mt-1 text-xs text-foreground font-medium">
                {detail.platform}
              </p>
            </div>
            {detail.webUiPort ? (
              <div className={`${STORE_PANEL_INSET} p-3`}>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Web UI Port
                </p>
                <p className="mt-1 text-xs text-foreground font-mono font-medium">
                  {detail.webUiPort}
                </p>
              </div>
            ) : null}
            <div className={`${STORE_PANEL_INSET} p-3 md:col-span-2`}>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Repository URL
              </p>
              {detail.repositoryUrl.startsWith("http://") ||
              detail.repositoryUrl.startsWith("https://") ? (
                <a
                  href={detail.repositoryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block text-xs text-primary hover:underline break-all"
                >
                  {detail.repositoryUrl}
                </a>
              ) : (
                <p className="mt-1 text-xs text-foreground break-all">
                  {detail.repositoryUrl}
                </p>
              )}
            </div>
          </div>

          {actionError ? (
            <p className="text-xs text-status-red">{actionError}</p>
          ) : null}

          <div className="flex items-center gap-2 flex-wrap">
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
                  <UpdateInfoTooltip app={detail}>
                    <button
                      onClick={onUpdate}
                      disabled={isOperationBusy(operation)}
                      title={buildUpdateTitle(detail)}
                      className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:brightness-110 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <ArrowUpCircle className="size-3.5" /> Update
                    </button>
                  </UpdateInfoTooltip>
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

function CategorySidebar({
  categories,
  selectedCategory,
  onSelect,
}: {
  categories: CatalogCategory[];
  selectedCategory: string | null;
  onSelect: (category: string | null) => void;
}) {
  return (
    <aside className={`m-2 w-56 shrink-0 overflow-y-auto p-4 ${STORE_PANEL_SHELL}`}>
      <div className="mb-4">
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          Categories
        </p>
      </div>
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors ${
            selectedCategory === null
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
          }`}
        >
          <span>All</span>
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.name)}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors ${
              selectedCategory === category.name
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
            }`}
            title={category.description}
          >
            <span className="truncate">{category.name}</span>
            <span className={`${STORE_BADGE_SURFACE} px-1.5 py-0.5 text-[10px]`}>
              {category.appCount}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function getSectionDescription(variant: "featured" | "recommended") {
  if (variant === "featured") {
    return "Spotlighted services with polished setups and strong out-of-the-box value.";
  }

  return "Curated picks that pair well with a growing self-hosted stack.";
}

function getSectionGridSpan(index: number) {
  if (index === 0) {
    return "xl:col-span-2";
  }

  if (index === 1) {
    return "xl:col-span-2";
  }

  return "";
}

function getSectionCardTone(
  variant: "featured" | "recommended",
  index: number,
) {
  if (variant === "featured") {
    return index === 0
      ? "from-primary/24 via-primary/10 to-chart-3/18"
      : "from-primary/16 via-transparent to-chart-2/12";
  }

  return index === 0
    ? "from-chart-2/24 via-chart-1/10 to-chart-4/20"
    : "from-chart-2/14 via-transparent to-primary/10";
}

function getSectionStatusPill(app: StoreAppSummary) {
  if (app.status === "error") {
    return {
      label: "Error",
      className: "border-status-red/30 bg-status-red/12 text-status-red",
    };
  }

  if (app.status === "installed") {
    return app.updateAvailable
      ? {
          label: "Update",
          className: "border-primary/30 bg-primary/12 text-primary",
        }
      : {
          label: "Installed",
          className:
            "border-status-green/30 bg-status-green/12 text-status-green",
        };
  }

  return null;
}

function SectionCard({
  title,
  icon,
  apps,
  onSelect,
  variant,
}: {
  title: string;
  icon: ReactNode;
  apps: StoreAppSummary[];
  onSelect: (appId: string) => void;
  variant: "featured" | "recommended";
}) {
  if (apps.length === 0) return null;

  const visibleApps = apps.slice(0, STORE_SECTION_CARD_LIMIT);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          </div>
          <p className="max-w-2xl text-xs leading-5 text-muted-foreground">
            {getSectionDescription(variant)}
          </p>
        </div>
        <div className={`${STORE_BADGE_SURFACE} flex items-center gap-2 self-start px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground`}>
          <span>{visibleApps.length} picks</span>
        </div>
      </div>

      <div className="grid auto-rows-[minmax(13rem,auto)] grid-cols-[repeat(auto-fit,minmax(min(100%,17rem),1fr))] gap-3">
        {visibleApps.map((app, index) => {
          const isHero = index === 0;
          const statusPill = getSectionStatusPill(app);

          return (
            <button
              key={`${title}-${app.id}`}
              type="button"
              onClick={() => onSelect(app.id)}
              className={`group relative overflow-hidden rounded-[calc(var(--radius)+1rem)] border border-glass-border bg-card/78 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card/88 ${getSectionGridSpan(index)}`}
              style={{
                contentVisibility: "auto",
                containIntrinsicSize: isHero ? "340px" : "208px",
              }}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${getSectionCardTone(variant, index)} opacity-90`}
              />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background/28 to-transparent" />
              {isHero ? (
                <div className="absolute right-8 top-8 size-28 rounded-[var(--radius)] bg-primary/12 blur-3xl" />
              ) : null}

              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-[var(--radius)] border border-white/20 bg-background/55 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-foreground/80 backdrop-blur-sm">
                      {index === 0
                        ? "Hero pick"
                        : variant === "featured"
                          ? "Spotlight"
                          : "Curated"}
                    </span>
                  </div>
                  {statusPill ? (
                    <span
                      className={`shrink-0 rounded-[var(--radius)] border px-2.5 py-1 text-[11px] font-medium ${statusPill.className}`}
                    >
                      {statusPill.label}
                    </span>
                  ) : null}
                </div>

                <div
                  className={`mt-5 flex h-full ${
                    isHero
                      ? "flex-col gap-5 xl:flex-row xl:items-end"
                      : "flex-col gap-4"
                  }`}
                >
                  <div
                    className={`flex ${isHero ? "items-start gap-4" : "items-start gap-3"}`}
                  >
                    <div
                      className={`${isHero ? "size-16 rounded-[calc(var(--radius)+0.625rem)]" : "size-12 rounded-[calc(var(--radius)+0.375rem)]"} flex shrink-0 items-center justify-center overflow-hidden border border-glass-border/80 bg-background/70 shadow-sm`}
                    >
                      <StoreLogo
                        logoUrl={app.logoUrl}
                        alt={`${app.name} logo`}
                        className={`${isHero ? "size-9" : "size-7"} object-contain`}
                        fallbackLabel="section-app-logo-fallback"
                      />
                    </div>

                    <div className="min-w-0">
                      <p
                        className={`${isHero ? "text-xl" : "text-sm"} truncate font-semibold tracking-tight text-foreground`}
                      >
                        {app.name}
                      </p>
                      <p
                        className={`${isHero ? "mt-2 line-clamp-3 max-w-2xl text-sm leading-6" : "mt-1 line-clamp-2 text-xs leading-5"} text-muted-foreground`}
                      >
                        {app.description}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {app.categories
                          .slice(0, isHero ? 2 : 1)
                          .map((category) => (
                            <span
                              key={`${app.id}-${category}`}
                              className={`${STORE_BADGE_SURFACE} px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-foreground/75`}
                            >
                              {category}
                            </span>
                          ))}
                        {app.webUiPort ? (
                          <span className={`${STORE_BADGE_SURFACE} px-2 py-1 font-mono text-[10px] text-foreground/75`}>
                            :{app.webUiPort}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`flex items-end justify-between gap-3 ${
                      isHero
                        ? "mt-auto xl:min-w-52 xl:flex-col xl:items-end"
                        : ""
                    }`}
                  >
                    <div className="space-y-1 text-[11px] text-muted-foreground">
                      <p className="uppercase tracking-[0.18em] text-foreground/70">
                        {app.status === "installed"
                          ? app.updateAvailable
                            ? "Ready to update"
                            : "Installed and stable"
                          : "Available now"}
                      </p>
                      <p
                        className={`${isHero ? "max-w-56" : "max-w-44"} leading-5`}
                      >
                        {app.updateAvailable
                          ? "A newer image is available for this service."
                          : app.status === "installed"
                            ? "Open details to manage, redeploy, or customize the stack."
                            : isHero
                              ? "Review ports, screenshots, and install options from the detail panel."
                              : "Inspect setup details before installing."}
                      </p>
                    </div>

                    <div className="inline-flex items-center gap-2 text-xs font-medium text-foreground/85 transition-transform group-hover:translate-x-1">
                      <span>View details</span>
                      <span aria-hidden="true">-&gt;</span>
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function AppStore({
  onOpenCustomInstall,
  launchRequest,
}: {
  onOpenCustomInstall: () => void;
  launchRequest?: {
    nonce: number;
    search?: string;
    appId?: string;
  } | null;
}) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const [filter, setFilter] = useState<"all" | "installed">("all");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [customInstallTemplate, setCustomInstallTemplate] =
    useState<StoreAppDetail | null>(null);
  const [uninstallDialogApp, setUninstallDialogApp] =
    useState<StoreAppSummary | null>(null);
  const [uninstallError, setUninstallError] = useState<string | null>(null);
  const [uninstallPending, setUninstallPending] = useState(false);
  const [visibleCatalogCount, setVisibleCatalogCount] =
    useState(STORE_PAGE_SIZE);
  const [isSourcesDialogOpen, setIsSourcesDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const refreshAttemptedRef = useRef(false);

  const { operationsByApp, installApp, updateApp, redeployApp, uninstallApp } =
    useStoreActions();
  const storeSourcesQuery = useStoreSources();
  const { addSource, updateSource, refreshSource, removeSource } =
    useStoreSourceActions();
  const installedAppsQuery = useInstalledApps();

  const catalogQuery = useStoreCatalog({
    category: selectedCategory ?? undefined,
    search: debouncedSearch || undefined,
    installedOnly: filter === "installed",
  });

  const catalog = catalogQuery.data;
  const apps = useMemo(() => catalog?.apps ?? [], [catalog]);
  const categories = catalog?.categories ?? [];
  const visibleApps = useMemo(
    () => apps.slice(0, visibleCatalogCount),
    [apps, visibleCatalogCount],
  );
  const hasMoreApps = visibleApps.length < apps.length;

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

  const installedCount = installedAppsQuery.data?.length ?? 0;
  const appById = useMemo(
    () => new Map(apps.map((app) => [app.id, app])),
    [apps],
  );
  const featuredApps = useMemo(
    () =>
      (catalog?.featuredAppIds ?? [])
        .map((id) => appById.get(id))
        .filter(Boolean) as StoreAppSummary[],
    [appById, catalog?.featuredAppIds],
  );
  const recommendedApps = useMemo(
    () =>
      (catalog?.recommendedAppIds ?? [])
        .map((id) => appById.get(id))
        .filter(Boolean) as StoreAppSummary[],
    [appById, catalog?.recommendedAppIds],
  );
  const shouldShowSections =
    filter === "all" && !search.trim() && !selectedCategory;

  useEffect(() => {
    if (!launchRequest) return;

    setFilter("all");
    setSelectedCategory(null);
    setActionError(null);
    setSearch(launchRequest.search ?? "");
    setSelectedAppId(launchRequest.appId ?? null);
  }, [launchRequest]);

  useEffect(() => {
    if (refreshAttemptedRef.current) {
      return;
    }

    refreshAttemptedRef.current = true;

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/v1/store/check-updates", {
          method: "POST",
          cache: "no-store",
        });

        if (!response.ok || cancelled) {
          return;
        }

        await Promise.allSettled([
          queryClient.invalidateQueries({ queryKey: queryKeys.storeCatalog }),
          queryClient.invalidateQueries({ queryKey: queryKeys.installedApps }),
        ]);
      } catch {
        // Best-effort refresh only. The store should still open with cached state.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  useEffect(() => {
    setVisibleCatalogCount(STORE_PAGE_SIZE);
  }, [debouncedSearch, filter, selectedCategory]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasMoreApps || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        setVisibleCatalogCount((current) =>
          Math.min(current + STORE_PAGE_SIZE, apps.length),
        );
      },
      {
        rootMargin: "240px 0px",
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [apps.length, hasMoreApps]);

  async function startInstall(app: StoreAppSummary) {
    setActionError(null);

    try {
      await installApp({
        appId: app.id,
        webUiPort: app.webUiPort ?? undefined,
      });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to start install.",
      );
    }
  }

  async function startRedeploy(app: StoreAppSummary) {
    setActionError(null);

    try {
      await redeployApp({
        appId: app.id,
      });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to start redeploy.",
      );
    }
  }

  async function startUpdate(app: StoreAppSummary) {
    setActionError(null);

    try {
      await updateApp({
        appId: app.id,
      });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to start update.",
      );
    }
  }

  async function startUninstall(app: StoreAppSummary) {
    setActionError(null);
    setUninstallError(null);
    setUninstallDialogApp(app);
  }

  async function submitDetailAction(
    action: "install" | "update" | "redeploy" | "uninstall",
  ) {
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
          webUiPort: selectedSummary.webUiPort ?? undefined,
        });
        return;
      }

      if (action === "update") {
        await updateApp({
          appId: selectedSummary.id,
        });
        return;
      }

      await redeployApp({
        appId: selectedSummary.id,
      });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Request failed.",
      );
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
      setUninstallError(
        error instanceof Error ? error.message : "Unable to start uninstall.",
      );
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
            <div className="relative h-[50vh] w-[min(96vw,980px)] overflow-hidden rounded-[calc(var(--radius)+0.75rem)] border border-glass-border bg-card shadow-2xl">
              <AppConfiguratorPanel
                context="catalog_install"
                template={customInstallTemplate}
                actions={{
                  installApp,
                }}
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
    <div className="flex h-full flex-col">
      <div className={`relative z-10 m-2 flex shrink-0 items-center gap-3 border border-glass-border px-5 py-3 ${STORE_PANEL_SHELL}`}>
        <div className="flex items-center gap-1 rounded-lg bg-background/55 p-0.5">
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

        <AppStoreInstallMenu
          onInstallCustomClick={onOpenCustomInstall}
          onManageSourcesClick={() => setIsSourcesDialogOpen(true)}
        />

        <div className="relative w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search apps..."
            className="w-full rounded-lg border border-glass-border bg-background/55 py-1.5 pl-8 pr-3 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/40"
          />
        </div>
      </div>

      {uninstallDialog}
      <AppStoreSourcesDialog
        open={isSourcesDialogOpen}
        onOpenChange={setIsSourcesDialogOpen}
        sources={storeSourcesQuery.data ?? catalog?.sources ?? []}
        isLoading={storeSourcesQuery.isLoading}
        error={
          storeSourcesQuery.error instanceof Error
            ? storeSourcesQuery.error.message
            : null
        }
        addPending={addSource.isPending}
        pendingSourceId={
          (refreshSource.isPending ? (refreshSource.variables as string | undefined) : undefined) ??
          (updateSource.isPending
            ? (updateSource.variables as { sourceId: string } | undefined)?.sourceId
            : undefined) ??
          (removeSource.isPending ? (removeSource.variables as string | undefined) : undefined) ??
          null
        }
        onAddSource={async (input) => {
          await addSource.mutateAsync(input);
        }}
        onToggleSource={async (input) => {
          await updateSource.mutateAsync({
            sourceId: input.sourceId,
            payload: { enabled: input.enabled },
          });
        }}
        onRefreshSource={async (sourceId) => {
          await refreshSource.mutateAsync(sourceId);
        }}
        onRemoveSource={async (sourceId) => {
          await removeSource.mutateAsync(sourceId);
        }}
      />

      <div className="flex flex-1 overflow-hidden">
        <CategorySidebar
          categories={categories}
          selectedCategory={selectedCategory}
          onSelect={setSelectedCategory}
        />

        <div className={`m-2 flex-1 overflow-y-auto p-4 ${STORE_PANEL_SHELL}`}>
          {actionError ? (
            <div className="mb-3 rounded-lg border border-status-red/30 bg-status-red/10 px-3 py-2 text-xs text-status-red">
              {actionError}
            </div>
          ) : null}

          {catalogQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">
              Loading app catalog...
            </div>
          ) : catalogQuery.isError ? (
            <div className="text-sm text-status-red">
              Unable to load app catalog.
            </div>
          ) : apps.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <Search className="size-8 opacity-30" />
              <span className="text-sm">No apps found</span>
            </div>
          ) : (
            <div className="space-y-6">
              {shouldShowSections ? (
                <>
                  <SectionCard
                    title="Featured Apps"
                    icon={<Star className="size-4 text-primary" />}
                    apps={featuredApps}
                    onSelect={setSelectedAppId}
                    variant="featured"
                  />
                  <SectionCard
                    title="Recommended for You"
                    icon={<Sparkles className="size-4 text-primary" />}
                    apps={recommendedApps}
                    onSelect={setSelectedAppId}
                    variant="recommended"
                  />
                </>
              ) : null}

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      {selectedCategory
                        ? selectedCategory
                        : filter === "installed"
                          ? "Installed Apps"
                          : "Catalog"}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {apps.length} apps
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {visibleApps.map((app) => {
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
                        className="flex cursor-pointer items-center gap-3 rounded-[calc(var(--radius)+0.25rem)] border border-glass-border/80 bg-background/36 p-3 text-left transition-all hover:border-primary/20 hover:bg-background/58"
                        style={{
                          contentVisibility: "auto",
                          containIntrinsicSize: "88px",
                        }}
                      >
                        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[calc(var(--radius)+0.375rem)] border border-glass-border bg-card/82 shadow-sm">
                          <StoreLogo
                            logoUrl={app.logoUrl}
                            alt={`${app.name} logo`}
                            className="size-7 object-contain"
                            fallbackLabel="app-logo-fallback"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground truncate">
                              {app.name}
                            </span>
                            {app.webUiPort ? (
                              <span className={`${STORE_BADGE_SURFACE} shrink-0 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground`}>
                                :{app.webUiPort}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {app.description}
                          </p>
                          <div className="mt-1 flex items-center gap-1 flex-wrap">
                            <SourceBadge
                              sourceName={app.sourceName}
                              sourceKind={app.sourceKind}
                            />
                            {app.categories.slice(0, 2).map((category) => (
                              <span
                                key={`${app.id}-${category}`}
                                className={`${STORE_BADGE_SURFACE} px-1.5 py-0.5 text-[10px] text-muted-foreground`}
                              >
                                {category}
                              </span>
                            ))}
                          </div>
                          {operation ? (
                            <div className="mt-1">
                              <div className="h-1.5 overflow-hidden rounded-[var(--radius)] bg-muted">
                                <div
                                  className="h-full rounded-[var(--radius)] bg-primary transition-all"
                                  style={{
                                    width: `${Math.max(2, operation.progressPercent)}%`,
                                  }}
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
                                <UpdateInfoTooltip app={app}>
                                  <button
                                    onClick={() => void startUpdate(app)}
                                    disabled={busy}
                                    title={buildUpdateTitle(app)}
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-primary/15 text-primary rounded-md hover:bg-primary/25 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                  >
                                    <ArrowUpCircle className="size-3" /> Update
                                  </button>
                                </UpdateInfoTooltip>
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
                {hasMoreApps ? (
                  <div className="flex flex-col items-center gap-3 py-2">
                    <div
                      ref={loadMoreRef}
                      className="h-1 w-full"
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleCatalogCount((current) =>
                          Math.min(current + STORE_PAGE_SIZE, apps.length),
                        )
                      }
                        className="rounded-lg border border-glass-border bg-background/55 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
                    >
                      Load more apps
                    </button>
                  </div>
                ) : null}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
