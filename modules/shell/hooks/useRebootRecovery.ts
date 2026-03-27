"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { reloadBrowserWindow } from "@/lib/desktop/browser-reload";
import {
  POWER_ACTION_STATE_CHANGED_EVENT,
  clearPersistedPowerActionState,
  readPersistedPowerActionState,
  writePersistedPowerActionCompletion,
  type PersistedPowerActionState,
} from "@/lib/desktop/reboot-state";
import { queryKeys } from "@/lib/shared/query-keys";

type PowerActionRecoveryPhase = "starting" | "waiting" | "reconnecting";

const RECOVERY_POLL_MS = 2_000;
const STARTING_PHASE_MS = 4_000;
const MIN_RESTART_TRANSITION_MS = 12_000;

export function useRebootRecovery() {
  const queryClient = useQueryClient();
  const [powerActionState, setPowerActionState] = useState<PersistedPowerActionState | null>(
    null,
  );
  const [phase, setPhase] = useState<PowerActionRecoveryPhase>("starting");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncPowerActionState = () => {
      setPowerActionState(readPersistedPowerActionState(window.localStorage));
    };

    syncPowerActionState();
    setIsHydrated(true);

    const onStorage = () => {
      syncPowerActionState();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(POWER_ACTION_STATE_CHANGED_EVENT, onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(POWER_ACTION_STATE_CHANGED_EVENT, onStorage);
    };
  }, []);

  useEffect(() => {
    if (!isHydrated || !powerActionState || typeof window === "undefined") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let hasObservedUnavailable = false;

    const scheduleNextCheck = () => {
      if (cancelled) return;
      timer = setTimeout(() => {
        void checkRecovery();
      }, RECOVERY_POLL_MS);
    };

    const clearState = async (invalidateQueries: boolean, markCompleted = false) => {
      if (markCompleted && powerActionState.action === "update") {
        writePersistedPowerActionCompletion(window.localStorage, {
          action: "update",
          completedAt: new Date().toISOString(),
        });
      }

      clearPersistedPowerActionState(window.localStorage);

      if (invalidateQueries) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: queryKeys.currentUser,
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.systemMetrics,
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.installedApps,
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.powerSchedule,
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.systemBackups,
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.systemUpdates,
          }),
        ]);
      }

      if (!cancelled) {
        setPowerActionState(null);
      }

      if (!cancelled && markCompleted && powerActionState.action === "update") {
        reloadBrowserWindow();
      }
    };

    const checkRecovery = async () => {
      if (cancelled) return;

      const startedAtMs = Date.parse(powerActionState.startedAt);
      const elapsedMs = Number.isFinite(startedAtMs)
        ? Date.now() - startedAtMs
        : STARTING_PHASE_MS;

      setPhase(elapsedMs < STARTING_PHASE_MS ? "starting" : "waiting");

      try {
        const healthResponse = await fetch("/api/health", {
          cache: "no-store",
        });

        if (!healthResponse.ok) {
          hasObservedUnavailable = true;
          scheduleNextCheck();
          return;
        }

        if (cancelled) return;

        const canAttemptRecovery =
          hasObservedUnavailable || elapsedMs >= MIN_RESTART_TRANSITION_MS;

        if (!canAttemptRecovery) {
          scheduleNextCheck();
          return;
        }

        setPhase("reconnecting");

        const authResponse = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        if (!authResponse.ok) {
          if (authResponse.status === 401) {
            // After a restore, the DB is replaced with a backup copy. The user
            // may be locked out because the backup's password hash doesn't match
            // their current password. Set a one-shot flag so the login page can
            // show a helpful banner explaining why their credentials may not work.
            if (powerActionState.action === "restore") {
              try {
                window.localStorage.setItem("homeio:restore-banner", "1");
              } catch {
                // Best-effort only.
              }
            }
            await clearState(false);
            return;
          }

          scheduleNextCheck();
          return;
        }

        await clearState(true, true);
      } catch {
        hasObservedUnavailable = true;
        scheduleNextCheck();
      }
    };

    void checkRecovery();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [isHydrated, powerActionState, queryClient]);

  return {
    isHydrated,
    isActive: powerActionState !== null,
    action: powerActionState?.action ?? null,
    phase,
    startedAt: powerActionState?.startedAt ?? null,
  };
}
