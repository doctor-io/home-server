/**
 * Docker's own restart policies, kept verbatim so the value we store is the
 * value compose understands — no translation layer to drift.
 */
export const RESTART_POLICIES = ["no", "on-failure", "always", "unless-stopped"] as const;
export type RestartPolicy = (typeof RESTART_POLICIES)[number];

export const RESTART_POLICY_LABELS: Record<RestartPolicy, string> = {
  no: "Never restart",
  "on-failure": "Restart on failure",
  always: "Always restart",
  "unless-stopped": "Restart unless stopped",
};

export const RESTART_POLICY_HINTS: Record<RestartPolicy, string> = {
  no: "Homeio leaves the container alone when it exits.",
  "on-failure": "Restarts only when the container exits with an error.",
  always: "Restarts whenever it stops, including after a reboot.",
  "unless-stopped": "Like always, except a container you stopped stays stopped.",
};

export type AppHealthState =
  | "unknown"
  | "healthy"
  | "restarting"
  | "unhealthy"
  | "stopped_by_policy";

export type AppHealth = {
  appId: string;
  policy: RestartPolicy;
  /** Restarts allowed inside the window before the app is stopped and reported. */
  maxRestarts: number;
  windowMinutes: number;
  state: AppHealthState;
  restartCount: number;
  windowStartedAt: string | null;
  lastTransitionAt: string | null;
  mutedUntil: string | null;
};

export type AppHealthUpdate = {
  policy?: RestartPolicy;
  maxRestarts?: number;
  windowMinutes?: number;
  mutedUntil?: string | null;
};

export const APP_HEALTH_DEFAULTS = {
  policy: "no" as RestartPolicy,
  maxRestarts: 5,
  windowMinutes: 10,
} as const;

export function isRestartPolicy(value: unknown): value is RestartPolicy {
  return typeof value === "string" && (RESTART_POLICIES as readonly string[]).includes(value);
}
