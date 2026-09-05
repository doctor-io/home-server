"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Bell, Check, RefreshCw } from "@/components/icons/platform-icons";
import type { PushConfigPublic } from "@/lib/shared/contracts/push";
import { generateNtfyTopic, isGuessableTopic, validateNtfyTopic } from "@/lib/shared/push";
import { cn } from "@/lib/utils";
import {
  SectionDivider,
  SettingsInput,
  Toggle,
} from "@/modules/settings/components/panel/controls";
import { SETTINGS_PANEL_INSET } from "@/modules/settings/components/panel/surface";

const DEFAULT_NTFY_URL = "https://ntfy.sh";

type Draft = {
  enabled: boolean;
  includeContent: boolean;
  ntfyUrl: string;
  ntfyTopic: string;
  /** Null while untouched: an empty box must not clear a stored token. */
  ntfyToken: string | null;
};

type Status = { tone: "ok" | "error"; text: string };

function draftFrom(config: PushConfigPublic): Draft {
  return {
    enabled: config.enabled,
    includeContent: config.includeContent,
    ntfyUrl: config.ntfyUrl || DEFAULT_NTFY_URL,
    ntfyTopic: config.ntfyTopic ?? "",
    ntfyToken: null,
  };
}

function isDirty(draft: Draft, saved: PushConfigPublic) {
  return (
    draft.enabled !== saved.enabled ||
    draft.includeContent !== saved.includeContent ||
    draft.ntfyUrl !== (saved.ntfyUrl || DEFAULT_NTFY_URL) ||
    draft.ntfyTopic !== (saved.ntfyTopic ?? "") ||
    draft.ntfyToken !== null
  );
}

export function PushCard({ isDemoMode = false }: { isDemoMode?: boolean }) {
  const [saved, setSaved] = useState<PushConfigPublic | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/v1/settings/push");
        if (!response.ok) return;
        const json = (await response.json()) as { data: PushConfigPublic };
        if (cancelled) return;
        setSaved(json.data);
        setDraft(draftFrom(json.data));
      } catch {
        // A card that cannot load stays inert rather than showing a false "off".
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const patch = useCallback((update: Partial<Draft>) => {
    setStatus(null);
    setDraft((current) => (current ? { ...current, ...update } : current));
  }, []);

  const save = useCallback(async () => {
    if (!draft) return;

    const topicError = draft.ntfyTopic
      ? validateNtfyTopic(draft.ntfyTopic)
      : draft.enabled
        ? "Enter a topic"
        : null;
    if (topicError) {
      setStatus({ tone: "error", text: topicError });
      return;
    }

    setBusy("save");
    setStatus(null);
    try {
      const response = await fetch("/api/v1/settings/push", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: draft.enabled,
          includeContent: draft.includeContent,
          ntfyUrl: draft.ntfyUrl,
          ntfyTopic: draft.ntfyTopic || null,
          // Only travels when the operator touched it, so saving the toggle
          // does not require re-typing a token the server already holds.
          ...(draft.ntfyToken === null ? {} : { ntfyToken: draft.ntfyToken }),
        }),
      });

      const json = (await response.json()) as { data?: PushConfigPublic; error?: string };
      if (!response.ok || !json.data) throw new Error(json.error ?? "Could not save");

      setSaved(json.data);
      setDraft(draftFrom(json.data));
      setStatus({ tone: "ok", text: "Saved" });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not save",
      });
    } finally {
      setBusy(null);
    }
  }, [draft]);

  const sendTest = useCallback(async () => {
    setBusy("test");
    setStatus(null);
    try {
      const response = await fetch("/api/v1/settings/push/test", { method: "POST" });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not reach the push server");

      setStatus({ tone: "ok", text: "Sent — check the phone" });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not reach the push server",
      });
    } finally {
      setBusy(null);
    }
  }, []);

  if (!draft || !saved) return null;

  const dirty = isDirty(draft, saved);
  const guessable = draft.ntfyTopic.length > 0 && isGuessableTopic(draft.ntfyTopic);

  return (
    <>
      <SectionDivider title="Push to phone" />

      <div className={cn(SETTINGS_PANEL_INSET, "flex flex-col gap-1 px-4 py-1")}>
        <Toggle
          label="Send notifications to my phone"
          description="Alerts reach the Homeio app with it closed, over ntfy"
          enabled={draft.enabled}
          onToggle={() => patch({ enabled: !draft.enabled })}
          disabled={isDemoMode}
          // Only when it applies: the hint renders from the reason alone, so a
          // constant string would print "not available" on every install.
          disabledReason={isDemoMode ? "Not available in demo mode" : undefined}
        />

        <Toggle
          label="Put the alert text in the push"
          description={
            draft.includeContent
              ? "The push server sees your alert titles and messages"
              : "The push carries a signal only — the phone reads the alert from here"
          }
          enabled={draft.includeContent}
          onToggle={() => patch({ includeContent: !draft.includeContent })}
          disabled={isDemoMode}
          disabledReason={isDemoMode ? "Not available in demo mode" : undefined}
        />

        {draft.includeContent && (
          <p className="flex items-start gap-1.5 pb-2 text-2xs text-status-amber">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            &ldquo;Jellyfin stopped&rdquo; tells whoever runs that server rather a lot about
            your household. Leave this off unless the phone often cannot reach Homeio.
          </p>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <SettingsInput
              label="Topic"
              value={draft.ntfyTopic}
              placeholder="homeio-…"
              description={
                draft.includeContent
                  ? "The phone subscribes to this. Anyone who knows it can read your alerts."
                  : "The phone subscribes to this. Anyone who knows it learns when an alert fires, not what it says."
              }
              onChange={isDemoMode ? undefined : (value) => patch({ ntfyTopic: value.trim() })}
            />
          </div>
          <button
            type="button"
            onClick={() => patch({ ntfyTopic: generateNtfyTopic() })}
            disabled={isDemoMode}
            className="mb-2 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-glass-border px-2.5 py-1.5 text-2xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className="size-3" />
            Generate
          </button>
        </div>

        {guessable && (
          <p className="flex items-start gap-1.5 pb-2 text-2xs text-status-amber">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            Short topics are guessable, and on a public server that is the whole lock —
            generate one instead.
          </p>
        )}

        <SettingsInput
          label="Server"
          value={draft.ntfyUrl}
          placeholder={DEFAULT_NTFY_URL}
          description="ntfy.sh, or your own instance"
          onChange={isDemoMode ? undefined : (value) => patch({ ntfyUrl: value })}
        />

        <SettingsInput
          label="Access token"
          type="password"
          value={draft.ntfyToken ?? ""}
          placeholder={saved.hasToken ? "•••••••• saved" : "Only for protected topics"}
          onChange={isDemoMode ? undefined : (value) => patch({ ntfyToken: value })}
        />

        {saved.hasToken && draft.ntfyToken === null && (
          <button
            type="button"
            onClick={() => patch({ ntfyToken: "" })}
            className="-mt-1 w-fit pb-2 text-2xs text-muted-foreground/80 hover:text-foreground"
          >
            Remove the saved token
          </button>
        )}

        <div className="flex items-center gap-2 border-t border-glass-border/60 py-2.5">
          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || busy !== null || isDemoMode}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary/90 px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy === "save" ? "Saving…" : "Save"}
          </button>

          <button
            type="button"
            onClick={() => void sendTest()}
            // Testing a draft would prove nothing about what the server will
            // actually send, so the test runs on saved values only.
            disabled={dirty || busy !== null || !saved.ntfyTopic || isDemoMode}
            className="inline-flex items-center gap-1.5 rounded-lg border border-glass-border px-3 py-1.5 text-xs text-foreground disabled:opacity-50"
          >
            <Bell className="size-3.5" />
            {busy === "test" ? "Sending…" : "Send test"}
          </button>

          {status && (
            <span
              className={cn(
                "flex items-center gap-1.5 text-2xs",
                status.tone === "ok" ? "text-status-green" : "text-status-red",
              )}
              role={status.tone === "error" ? "alert" : undefined}
            >
              {status.tone === "ok" ? (
                <Check className="size-3.5" />
              ) : (
                <AlertTriangle className="size-3.5" />
              )}
              {status.text}
            </span>
          )}

          {dirty && !status && (
            <span className="text-2xs text-muted-foreground/70">Unsaved changes</span>
          )}
        </div>
      </div>
    </>
  );
}
