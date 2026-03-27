export const POWER_ACTION_STATE_STORAGE_KEY = "system.power.action.v1";
export const POWER_ACTION_COMPLETION_STORAGE_KEY = "system.power.action.completed.v1";
export const POWER_ACTION_STATE_CHANGED_EVENT = "homeio:power-action-state-changed";

export type PersistedPowerActionState = {
  action: "reboot" | "shutdown" | "factory-reset" | "restore" | "update";
  startedAt: string;
  requestDispatchedAt?: string;
};

export type PersistedPowerActionCompletion = {
  action: PersistedPowerActionState["action"];
  completedAt: string;
};

function parsePersistedPowerActionState(rawValue: string | null) {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as Partial<PersistedPowerActionState>;
    if (
      parsed.action !== "reboot" &&
      parsed.action !== "shutdown" &&
      parsed.action !== "factory-reset" &&
      parsed.action !== "restore" &&
      parsed.action !== "update"
    ) {
      return null;
    }
    if (typeof parsed.startedAt !== "string" || parsed.startedAt.length === 0) {
      return null;
    }

    return {
      action: parsed.action,
      startedAt: parsed.startedAt,
      requestDispatchedAt:
        typeof parsed.requestDispatchedAt === "string" && parsed.requestDispatchedAt.length > 0
          ? parsed.requestDispatchedAt
          : undefined,
    };
  } catch {
    return null;
  }
}

function parsePersistedPowerActionCompletion(rawValue: string | null) {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as Partial<PersistedPowerActionCompletion>;
    if (
      parsed.action !== "reboot" &&
      parsed.action !== "shutdown" &&
      parsed.action !== "factory-reset" &&
      parsed.action !== "restore" &&
      parsed.action !== "update"
    ) {
      return null;
    }
    if (typeof parsed.completedAt !== "string" || parsed.completedAt.length === 0) {
      return null;
    }

    return {
      action: parsed.action,
      completedAt: parsed.completedAt,
    };
  } catch {
    return null;
  }
}

function dispatchPowerActionStateChanged() {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new Event(POWER_ACTION_STATE_CHANGED_EVENT));
}

export function readPersistedPowerActionState(storage: Storage | undefined) {
  if (!storage) return null;

  try {
    return parsePersistedPowerActionState(
      storage.getItem(POWER_ACTION_STATE_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

export function writePersistedPowerActionState(
  storage: Storage | undefined,
  state: PersistedPowerActionState,
) {
  if (!storage) return;

  try {
    storage.setItem(POWER_ACTION_STATE_STORAGE_KEY, JSON.stringify(state));
    dispatchPowerActionStateChanged();
  } catch {
    // Best-effort only.
  }
}

export function clearPersistedPowerActionState(storage: Storage | undefined) {
  if (!storage) return;

  try {
    storage.removeItem(POWER_ACTION_STATE_STORAGE_KEY);
    dispatchPowerActionStateChanged();
  } catch {
    // Best-effort only.
  }
}

export function readPersistedPowerActionCompletion(storage: Storage | undefined) {
  if (!storage) return null;

  try {
    return parsePersistedPowerActionCompletion(
      storage.getItem(POWER_ACTION_COMPLETION_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

export function writePersistedPowerActionCompletion(
  storage: Storage | undefined,
  completion: PersistedPowerActionCompletion,
) {
  if (!storage) return;

  try {
    storage.setItem(POWER_ACTION_COMPLETION_STORAGE_KEY, JSON.stringify(completion));
    dispatchPowerActionStateChanged();
  } catch {
    // Best-effort only.
  }
}

export function clearPersistedPowerActionCompletion(storage: Storage | undefined) {
  if (!storage) return;

  try {
    storage.removeItem(POWER_ACTION_COMPLETION_STORAGE_KEY);
    dispatchPowerActionStateChanged();
  } catch {
    // Best-effort only.
  }
}
