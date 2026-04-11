"use client";

import { getStoreOperationActionLabel } from "@/lib/shared/store-operations";
import {
  getAppVisualState,
  type ActiveAppOperation,
  type AppItem,
} from "@/modules/apps/components/app-grid-presenters";
import { Loader2 } from "@/components/icons/platform-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, type MouseEvent } from "react";

type AppGridContentProps = {
  activeAppId: string | null;
  activeOperationsCount: number;
  animationsEnabled: boolean;
  apps: AppItem[];
  iconSize: "small" | "medium" | "large";
  isAppsError: boolean;
  isAppsLoading: boolean;
  onAppContextMenu: (event: MouseEvent, app: AppItem) => void;
  onOpenApp: (app: AppItem) => void;
  primaryOperation: ActiveAppOperation | null;
};

export function AppGridContent({
  activeAppId,
  activeOperationsCount,
  animationsEnabled,
  apps,
  iconSize,
  isAppsError,
  isAppsLoading,
  onAppContextMenu,
  onOpenApp,
  primaryOperation,
}: AppGridContentProps) {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const iconContainerClass =
    iconSize === "small"
      ? "size-12 rounded-xl"
      : iconSize === "large"
        ? "size-16 rounded-3xl"
        : "size-14 rounded-2xl";
  const iconGlyphClass =
    iconSize === "small"
      ? "size-6"
      : iconSize === "large"
        ? "size-8"
        : "size-7";

  return (
    <>
      {primaryOperation ? (
        <div
          className="mx-auto mt-4 flex w-full max-w-xl items-center justify-between gap-3 rounded-2xl border border-status-amber/25 bg-status-amber/10 px-4 py-3 text-xs text-status-amber shadow-lg shadow-black/10 backdrop-blur-xl"
          role="status"
          aria-live="polite"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-[var(--radius)] bg-status-amber/15">
              <Loader2 className="size-4 animate-spin" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground tracking-tight">
                {getStoreOperationActionLabel(primaryOperation.action)}{" "}
                {primaryOperation.appName}
              </p>
              <p className="truncate text-2xs uppercase tracking-[0.12em] text-muted-foreground font-mono">
                {activeOperationsCount > 1
                  ? `${activeOperationsCount} app actions in progress`
                  : primaryOperation.status === "queued"
                    ? "Queued"
                    : "Applying changes"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden h-1.5 w-24 overflow-hidden rounded-[var(--radius)] bg-white/10 sm:block">
              <div
                className="h-full rounded-[var(--radius)] bg-status-amber transition-all"
                style={{
                  width: `${Math.max(8, primaryOperation.progressPercent)}%`,
                }}
              />
            </div>
            <span className="tabular-nums text-2xs font-mono font-medium text-foreground">
              {primaryOperation.progressPercent}%
            </span>
          </div>
        </div>
      ) : null}

      {isAppsLoading && apps.length === 0 ? (
        <div className="mt-24" role="status" aria-live="polite">
          <div className="mx-auto flex max-w-xs flex-col items-center text-center">
            <div className="relative h-1 w-48 overflow-hidden rounded-full bg-glass-border/30">
              <div className="absolute inset-0 animate-grid-scan rounded-full bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
            </div>
            <p className="mt-4 text-2xs uppercase tracking-[0.2em] font-mono text-muted-foreground">
              Syncing containers
            </p>
          </div>
          {/* Skeleton placeholder icons that match the real grid layout */}
          <div
            aria-hidden="true"
            className="mt-8 grid grid-cols-[repeat(4,minmax(0,5.5rem))] justify-center gap-x-1 gap-y-6 opacity-40 sm:grid-cols-[repeat(5,minmax(0,5.5rem))] md:grid-cols-[repeat(6,minmax(0,5.5rem))] lg:grid-cols-[repeat(8,minmax(0,5.5rem))] xl:grid-cols-[repeat(10,minmax(0,5.5rem))]"
          >
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 p-2">
                <Skeleton className={`${iconContainerClass} shrink-0`} />
                <Skeleton className="h-2.5 w-12 rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : isAppsError && apps.length === 0 ? (
        <div className="mt-24 text-center">
          <p className="text-2xs uppercase tracking-[0.2em] font-mono text-status-red">
            Connection failed
          </p>
        </div>
      ) : apps.length === 0 ? (
        <div className="mt-24 min-h-[12rem]" aria-hidden="true" />
      ) : (
        <div className="mt-24 grid grid-cols-[repeat(4,minmax(0,5.5rem))] justify-center gap-x-1 gap-y-6 sm:grid-cols-[repeat(5,minmax(0,5.5rem))] md:grid-cols-[repeat(6,minmax(0,5.5rem))] lg:grid-cols-[repeat(8,minmax(0,5.5rem))] xl:grid-cols-[repeat(10,minmax(0,5.5rem))]">
          {apps.map((app) => {
            const visualState = getAppVisualState(app);
            const BadgeIcon = visualState.badgeIcon;
            const animatedContainerClass = animationsEnabled
              ? visualState.containerClass
              : "";
            const animatedDotInnerClass = animationsEnabled
              ? visualState.dotInnerClass
              : "";

            return (
              <button
                key={app.id}
                onClick={() => onOpenApp(app)}
                onContextMenu={(event) => onAppContextMenu(event, app)}
                className={`group flex flex-col items-center gap-2 rounded-xl p-2 cursor-pointer ${
                  activeAppId === app.id
                    ? "bg-primary/15 ring-1 ring-primary/40"
                    : "hover:bg-foreground/5"
                } ${animationsEnabled ? "transition-all duration-200" : ""} ${
                  animationsEnabled ? "group-active:scale-95" : ""
                }`}
                aria-label={`Open ${app.name}`}
                data-app-status={app.status}
                title={visualState.title}
              >
                <div className="relative">
                  <div
                    className={`${iconContainerClass} relative flex items-center justify-center overflow-hidden border grain-overlay ${visualState.ringClass} ${!app.logoUrl ? `${app.bgColor} ${app.color}` : "bg-white/90"} shadow-lg shadow-black/20 ${
                      animationsEnabled
                        ? `transition-transform duration-200 group-hover:scale-110 ${animatedContainerClass}`
                        : ""
                    }`}
                  >
                    {app.logoUrl ? (
                      <>
                        {!loadedImages.has(app.logoUrl) ? (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className={`${iconGlyphClass} animate-pulse`}>
                              <app.icon className="h-full w-full opacity-30" />
                            </div>
                          </div>
                        ) : null}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={app.logoUrl}
                          alt={`${app.name} logo`}
                          className={`h-full w-full rounded-xl object-contain p-1.5 ${visualState.imageClass}`}
                          loading="lazy"
                          decoding="async"
                          onLoad={() => {
                            setLoadedImages((previous) =>
                              new Set(previous).add(app.logoUrl!),
                            );
                          }}
                          onError={(event) => {
                            const img = event.currentTarget;
                            const container = img.parentElement;
                            if (!container) return;
                            img.style.display = "none";
                            container.classList.remove("bg-white/90");
                            container.classList.add(app.bgColor, app.color);
                            const fallback = container.querySelector(
                              "[data-fallback-icon]",
                            );
                            if (fallback instanceof HTMLElement) {
                              fallback.style.display = "block";
                            }
                          }}
                        />
                        <app.icon
                          className={`${iconGlyphClass} hidden ${visualState.imageClass}`}
                          data-fallback-icon
                        />
                      </>
                    ) : (
                      <app.icon
                        className={`${iconGlyphClass} ${visualState.imageClass}`}
                      />
                    )}
                  </div>
                  {BadgeIcon ? (
                    <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                      <span
                        className={`flex size-4 items-center justify-center rounded-[var(--radius)] border border-background ${visualState.badgeClass}`}
                      >
                        <BadgeIcon
                          className={`size-2.5 ${
                            animationsEnabled ? visualState.badgeIconClass : ""
                          }`}
                        />
                      </span>
                    </span>
                  ) : null}

                  {animatedDotInnerClass ? (
                    <span
                      className={`pointer-events-none absolute -bottom-0.5 -right-0.5 size-3 rounded-[var(--radius)] ${animatedDotInnerClass}`}
                    />
                  ) : null}
                  {app.updateAvailable && app.status === "running" ? (
                    <span
                      className="pointer-events-none absolute -top-0.5 -right-0.5 size-2.5 rounded-full border border-background bg-primary"
                      title="Update available"
                    />
                  ) : null}
                </div>

                <span
                  className={`max-w-[4.5rem] truncate text-center text-2xs font-medium leading-tight tracking-tight text-foreground/80 ${
                    animationsEnabled
                      ? "transition-colors group-hover:text-foreground"
                      : ""
                  }`}
                >
                  {app.name}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
