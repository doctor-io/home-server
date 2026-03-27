"use client";

import { useEffect, useState } from "react";
import {
  POWER_ACTION_STATE_CHANGED_EVENT,
  readPersistedPowerActionState,
  writePersistedPowerActionState,
  type PersistedPowerActionState,
} from "@/lib/desktop/reboot-state";

export function useUpdateRecoveryState() {
  const [isUpdateRecoveryActive, setIsUpdateRecoveryActive] = useState(() => {
    if (typeof window === "undefined") return false;
    return readPersistedPowerActionState(window.localStorage)?.action === "update";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncUpdateRecoveryState = () => {
      const persistedState = readPersistedPowerActionState(window.localStorage);
      setIsUpdateRecoveryActive(persistedState?.action === "update");
    };

    syncUpdateRecoveryState();

    window.addEventListener("storage", syncUpdateRecoveryState);
    window.addEventListener(POWER_ACTION_STATE_CHANGED_EVENT, syncUpdateRecoveryState);

    return () => {
      window.removeEventListener("storage", syncUpdateRecoveryState);
      window.removeEventListener(POWER_ACTION_STATE_CHANGED_EVENT, syncUpdateRecoveryState);
    };
  }, []);

  return {
    isUpdateRecoveryActive,
    setIsUpdateRecoveryActive,
  };
}

export function persistPowerActionState(
  action: PersistedPowerActionState["action"],
  overrides?: Partial<PersistedPowerActionState>,
) {
  if (typeof window === "undefined") return;

  writePersistedPowerActionState(window.localStorage, {
    action,
    startedAt: new Date().toISOString(),
    ...overrides,
  });
}
