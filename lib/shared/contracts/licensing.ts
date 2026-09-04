/**
 * What a paid plan unlocks.
 *
 * Every entitlement here gates something that does not exist in the core, or a
 * control the core already ships as unavailable. Nothing that works today on a
 * stock install may ever move behind one of these.
 */
export const ENTITLEMENTS = [
  "multi-server",
  "sso",
  "alert-rules",
  "hosted-relay",
] as const;

export type Entitlement = (typeof ENTITLEMENTS)[number];

export const ENTITLEMENT_LABELS: Record<Entitlement, string> = {
  "multi-server": "Manage several servers from one interface",
  sso: "Single sign-on and user roles",
  "alert-rules": "Threshold alerts and extended history",
  "hosted-relay": "Hosted remote access and notifications",
};

export const LICENSE_PLANS = ["free", "pro", "business"] as const;

export type LicensePlan = (typeof LICENSE_PLANS)[number];

/** Why the server is running on the entitlements it has. */
export type LicenseStatus =
  | "unlicensed"
  | "active"
  | "expired"
  | "invalid";

/**
 * What the server tells the UI about its licence. Deliberately excludes the
 * licence token itself: the UI never needs it, and it must not end up in a
 * browser cache or a support screenshot.
 */
export type EntitlementsSnapshot = {
  status: LicenseStatus;
  plan: LicensePlan;
  entitlements: Entitlement[];
  licensedTo: string | null;
  expiresAt: string | null;
};

export const UNLICENSED_SNAPSHOT: EntitlementsSnapshot = {
  status: "unlicensed",
  plan: "free",
  entitlements: [],
  licensedTo: null,
  expiresAt: null,
};

export function isEntitlement(value: unknown): value is Entitlement {
  return (
    typeof value === "string" &&
    (ENTITLEMENTS as readonly string[]).includes(value)
  );
}

export function isLicensePlan(value: unknown): value is LicensePlan {
  return (
    typeof value === "string" &&
    (LICENSE_PLANS as readonly string[]).includes(value)
  );
}
