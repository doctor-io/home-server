"use client";

import { useState } from "react";
import { Download, RefreshCw } from "@/components/icons/platform-icons";

type CustomAppSourceActionsProps = {
  appId: string;
  disabled?: boolean;
};

type CheckState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "unchanged"; lastImportedAt: string | null }
  | { phase: "changed"; sourceUrl: string }
  | { phase: "not_imported" }
  | { phase: "error"; message: string };

function formatWhen(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString();
}

/**
 * Update check and export for apps that came from a compose file rather than
 * the catalog. Both are read-only: taking an update means re-importing, which
 * runs the risk gate again.
 */
export function CustomAppSourceActions({ appId, disabled = false }: CustomAppSourceActionsProps) {
  const [state, setState] = useState<CheckState>({ phase: "idle" });

  async function check() {
    setState({ phase: "checking" });

    try {
      const response = await fetch(
        `/api/v1/store/custom-apps/${encodeURIComponent(appId)}/check-import`,
        { method: "POST" },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        data?: { changed: boolean; sourceUrl: string; lastImportedAt: string | null };
        error?: string;
        code?: string;
      };

      if (payload.code === "not_imported") {
        setState({ phase: "not_imported" });
        return;
      }

      if (!response.ok || !payload.data) {
        setState({ phase: "error", message: payload.error ?? "Could not check for updates" });
        return;
      }

      setState(
        payload.data.changed
          ? { phase: "changed", sourceUrl: payload.data.sourceUrl }
          : { phase: "unchanged", lastImportedAt: payload.data.lastImportedAt },
      );
    } catch {
      setState({ phase: "error", message: "Could not reach the server" });
    }
  }

  const importedOn = state.phase === "unchanged" ? formatWhen(state.lastImportedAt) : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={check}
          disabled={disabled || state.phase === "checking"}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-glass-border bg-background/55 px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`size-3.5 ${state.phase === "checking" ? "animate-spin" : ""}`} />
          {state.phase === "checking" ? "Checking…" : "Check source"}
        </button>

        <a
          href={`/api/v1/store/custom-apps/${encodeURIComponent(appId)}/compose`}
          download
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-glass-border bg-background/55 px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Download className="size-3.5" /> Export
        </a>
      </div>

      {state.phase === "unchanged" && (
        <p className="text-2xs text-muted-foreground">
          Up to date with its source{importedOn ? ` · imported ${importedOn}` : ""}.
        </p>
      )}

      {state.phase === "changed" && (
        <p className="text-2xs text-status-amber">
          The source has changed since this was imported. Import it again from the same URL to
          take the update — you will be shown what it asks for before it installs.
        </p>
      )}

      {state.phase === "not_imported" && (
        <p className="text-2xs text-muted-foreground">
          This app was pasted rather than imported, so there is no source to check.
        </p>
      )}

      {state.phase === "error" && (
        <p className="text-2xs text-status-red" role="alert">
          {state.message}
        </p>
      )}
    </div>
  );
}
