"use client";

import { useEffect, useState } from "react";
import {
  APP_HEALTH_DEFAULTS,
  RESTART_POLICIES,
  RESTART_POLICY_HINTS,
  RESTART_POLICY_LABELS,
  type AppHealth,
  type RestartPolicy,
} from "@/lib/shared/contracts/app-health";

type HealthPolicyCardProps = {
  appId: string;
};

const STATE_LABELS: Record<AppHealth["state"], string> = {
  unknown: "Not observed yet",
  healthy: "Healthy",
  restarting: "Restarting",
  unhealthy: "Unhealthy",
  stopped_by_policy: "Stopped after repeated crashes",
};

const STATE_TONES: Record<AppHealth["state"], string> = {
  unknown: "bg-white/25",
  healthy: "bg-status-green",
  restarting: "bg-status-amber",
  unhealthy: "bg-status-red",
  stopped_by_policy: "bg-status-red",
};

const MUTE_HOURS = 24;

export function HealthPolicyCard({ appId }: HealthPolicyCardProps) {
  const [health, setHealth] = useState<AppHealth | null>(null);
  const [policy, setPolicy] = useState<RestartPolicy>(APP_HEALTH_DEFAULTS.policy);
  // Annotated: APP_HEALTH_DEFAULTS is `as const`, so inference would pin these
  // to the literal types 5 and 10 and reject any other number.
  const [maxRestarts, setMaxRestarts] = useState<number>(APP_HEALTH_DEFAULTS.maxRestarts);
  const [windowMinutes, setWindowMinutes] = useState<number>(APP_HEALTH_DEFAULTS.windowMinutes);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`/api/v1/apps/${encodeURIComponent(appId)}/health`);
        if (!response.ok) throw new Error("failed");

        const json = (await response.json()) as { data: AppHealth };
        if (cancelled) return;

        setHealth(json.data);
        setPolicy(json.data.policy);
        setMaxRestarts(json.data.maxRestarts);
        setWindowMinutes(json.data.windowMinutes);
      } catch {
        if (!cancelled) setError("Could not read the restart policy for this app.");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [appId]);

  async function save(overrides: Record<string, unknown> = {}) {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/apps/${encodeURIComponent(appId)}/health`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ policy, maxRestarts, windowMinutes, ...overrides }),
      });
      if (!response.ok) throw new Error("failed");

      const json = (await response.json()) as { data: AppHealth };
      setHealth(json.data);
      setSavedAt(Date.now());
    } catch {
      setError("Could not save the restart policy.");
    } finally {
      setIsSaving(false);
    }
  }

  const isMuted = Boolean(health?.mutedUntil && new Date(health.mutedUntil) > new Date());
  const state = health?.state ?? "unknown";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-glass-border bg-black/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">Health &amp; recovery</span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`size-2 rounded-full ${STATE_TONES[state]}`} />
          <span className="text-2xs text-muted-foreground">{STATE_LABELS[state]}</span>
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="restart-policy" className="text-2xs font-medium text-muted-foreground">
          Restart policy
        </label>
        <select
          id="restart-policy"
          value={policy}
          onChange={(event) => setPolicy(event.target.value as RestartPolicy)}
          className="cursor-pointer rounded-lg border border-glass-border bg-black/30 px-2.5 py-2 text-xs text-foreground outline-none transition-colors focus:border-primary/50"
        >
          {RESTART_POLICIES.map((value) => (
            <option key={value} value={value} className="bg-neutral-900">
              {RESTART_POLICY_LABELS[value]}
            </option>
          ))}
        </select>
        <p className="text-2xs leading-relaxed text-muted-foreground">
          {RESTART_POLICY_HINTS[policy]}
        </p>
      </div>

      {/* A budget only means something once something can restart. */}
      {policy !== "no" && (
        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="max-restarts" className="text-2xs font-medium text-muted-foreground">
              Give up after
            </label>
            <input
              id="max-restarts"
              type="number"
              min={1}
              max={50}
              value={maxRestarts}
              onChange={(event) => setMaxRestarts(Number(event.target.value))}
              className="rounded-lg border border-glass-border bg-black/30 px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary/50"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="window-minutes" className="text-2xs font-medium text-muted-foreground">
              restarts within (min)
            </label>
            <input
              id="window-minutes"
              type="number"
              min={1}
              max={1440}
              value={windowMinutes}
              onChange={(event) => setWindowMinutes(Number(event.target.value))}
              className="rounded-lg border border-glass-border bg-black/30 px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary/50"
            />
          </div>
        </div>
      )}

      {health && health.restartCount > 0 && (
        <p className="text-2xs text-muted-foreground">
          {health.restartCount} restart{health.restartCount === 1 ? "" : "s"} counted in the
          current window.
        </p>
      )}

      {error && (
        <p className="text-2xs text-status-red" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={isSaving}
          className="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-2xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {isSaving ? "Saving…" : "Save policy"}
        </button>

        <button
          type="button"
          onClick={() =>
            void save({
              mutedUntil: isMuted
                ? null
                : new Date(Date.now() + MUTE_HOURS * 3_600_000).toISOString(),
            })
          }
          disabled={isSaving}
          className="cursor-pointer rounded-md border border-glass-border px-3 py-1.5 text-2xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
        >
          {/* Debugging an app means wanting the watchdog to stop interfering. */}
          {isMuted ? "Resume auto-heal" : `Mute for ${MUTE_HOURS} h`}
        </button>

        {savedAt !== null && !isSaving && !error && (
          <span className="text-2xs text-status-green">Saved</span>
        )}
      </div>
    </div>
  );
}
