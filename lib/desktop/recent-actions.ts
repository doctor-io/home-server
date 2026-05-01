export const RECENT_COMMAND_ACTIONS_STORAGE_KEY = "homeio.command-palette.recent.v1";
const MAX_RECENT_COMMAND_ACTIONS = 6;

export type RecentCommandAction =
  | {
      key: string;
      kind: "window";
      title: string;
      subtitle: string;
      windowId: "files" | "settings" | "app-store" | "terminal" | "monitor" | "notifications" | "app-settings" | "disk-manager";
    }
  | {
      key: string;
      kind: "settings-section";
      title: string;
      subtitle: string;
      sectionId: string;
    }
  | {
      key: string;
      kind: "app-store-search";
      title: string;
      subtitle: string;
      search: string;
      appId?: string;
    };

type WindowRecentAction = Extract<RecentCommandAction, { kind: "window" }>;

function isWindowId(value: unknown): value is WindowRecentAction["windowId"] {
  return (
    value === "files" ||
    value === "settings" ||
    value === "app-store" ||
    value === "terminal" ||
    value === "monitor" ||
    value === "notifications" ||
    value === "app-settings" ||
    value === "disk-manager"
  );
}

function isRecentCommandAction(value: unknown): value is RecentCommandAction {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<RecentCommandAction>;
  if (
    typeof candidate.key !== "string" ||
    typeof candidate.title !== "string" ||
    typeof candidate.subtitle !== "string"
  ) {
    return false;
  }

  if (candidate.kind === "window") {
    return isWindowId(candidate.windowId);
  }

  if (candidate.kind === "settings-section") {
    return typeof candidate.sectionId === "string";
  }

  if (candidate.kind === "app-store-search") {
    return (
      typeof candidate.search === "string" &&
      (candidate.appId === undefined || typeof candidate.appId === "string")
    );
  }

  return false;
}

export function readRecentCommandActions(storage: Storage | undefined) {
  if (!storage) return [];

  try {
    const rawValue = storage.getItem(RECENT_COMMAND_ACTIONS_STORAGE_KEY);
    if (!rawValue) return [];

    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isRecentCommandAction).slice(0, MAX_RECENT_COMMAND_ACTIONS);
  } catch {
    return [];
  }
}

export function writeRecentCommandActions(
  storage: Storage | undefined,
  actions: RecentCommandAction[],
) {
  if (!storage) return;

  try {
    storage.setItem(
      RECENT_COMMAND_ACTIONS_STORAGE_KEY,
      JSON.stringify(actions.slice(0, MAX_RECENT_COMMAND_ACTIONS)),
    );
  } catch {
    // Best-effort only.
  }
}

export function pushRecentCommandAction(
  storage: Storage | undefined,
  action: RecentCommandAction,
) {
  const current = readRecentCommandActions(storage);
  const next = [action, ...current.filter((entry) => entry.key !== action.key)].slice(
    0,
    MAX_RECENT_COMMAND_ACTIONS,
  );
  writeRecentCommandActions(storage, next);
  return next;
}
