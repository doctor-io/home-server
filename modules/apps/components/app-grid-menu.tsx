"use client";

import type { AppItem } from "@/modules/apps/components/app-grid-presenters";
import {
  Copy,
  ExternalLink,
  Play,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Settings2,
  Square,
  TerminalSquare,
  Trash2,
} from "@/components/icons/platform-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ReactNode } from "react";

type AppGridAction =
  | "open"
  | "start"
  | "stop"
  | "restart"
  | "logs"
  | "terminal"
  | "settings"
  | "update"
  | "copy-url"
  | "remove";

export function AppGridContextMenu({
  app,
  hasDashboardUrl,
  isBusy,
  x,
  y,
  onAction,
}: {
  app: AppItem;
  hasDashboardUrl: boolean;
  isBusy: boolean;
  x: number;
  y: number;
  onAction: (action: AppGridAction) => void;
}) {
  return (
    <div
      className="fixed z-[220] min-w-48 rounded-xl border border-glass-border bg-popover py-1.5 shadow-2xl shadow-black/50 backdrop-blur-2xl"
      style={{ left: x, top: y }}
      onClick={(event) => event.stopPropagation()}
    >
      <AppGridContextMenuItem
        icon={<ExternalLink className="size-3.5" />}
        label="Open Dashboard"
        disabled={!hasDashboardUrl}
        title={!hasDashboardUrl ? "No web port configured for this app." : undefined}
        onClick={() => onAction("open")}
      />
      {app.status === "running" || app.status === "partial" ? (
        <AppGridContextMenuItem
          icon={<Square className="size-3.5" />}
          label="Stop Container"
          disabled={isBusy}
          onClick={() => onAction("stop")}
        />
      ) : (
        <AppGridContextMenuItem
          icon={<Play className="size-3.5" />}
          label="Start Container"
          disabled={isBusy}
          onClick={() => onAction("start")}
        />
      )}
      <AppGridContextMenuItem
        icon={<RotateCcw className="size-3.5" />}
        label="Restart Container"
        disabled={isBusy}
        onClick={() => onAction("restart")}
      />
      <AppGridContextMenuItem
        icon={<ScrollText className="size-3.5" />}
        label="View Logs"
        onClick={() => onAction("logs")}
      />
      <AppGridContextMenuItem
        icon={<TerminalSquare className="size-3.5" />}
        label="Open in Terminal"
        onClick={() => onAction("terminal")}
      />
      <div className="mx-2 my-1 h-px bg-border" />
      <AppGridContextMenuItem
        icon={<Settings2 className="size-3.5" />}
        label="App Settings"
        onClick={() => onAction("settings")}
      />
      <AppGridContextMenuItem
        icon={<RefreshCw className="size-3.5" />}
        label="Check Updates"
        disabled={isBusy}
        onClick={() => onAction("update")}
      />
      <AppGridContextMenuItem
        icon={<Copy className="size-3.5" />}
        label="Copy URL"
        disabled={!hasDashboardUrl}
        title={!hasDashboardUrl ? "No web port configured for this app." : undefined}
        onClick={() => onAction("copy-url")}
      />
      <div className="mx-2 my-1 h-px bg-border" />
      <AppGridContextMenuItem
        icon={<Trash2 className="size-3.5 text-status-red" />}
        label="Remove App"
        danger
        disabled={isBusy}
        onClick={() => onAction("remove")}
      />
    </div>
  );
}

function AppGridContextMenuItem({
  danger,
  disabled,
  icon,
  label,
  onClick,
  title,
}: {
  danger?: boolean;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  title?: string;
}) {
  const button = (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-xs transition-colors ${
        danger
          ? "text-status-red hover:bg-status-red/10 disabled:hover:bg-transparent"
          : "text-foreground hover:bg-secondary/50"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {icon}
      {label}
    </button>
  );

  if (title) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block">{button}</span>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>{title}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
