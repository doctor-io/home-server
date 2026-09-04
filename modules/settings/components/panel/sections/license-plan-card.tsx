"use client";

import { AlertTriangle, Sparkles } from "@/components/icons/platform-icons";
import {
  ENTITLEMENT_LABELS,
  type EntitlementsSnapshot,
  type LicensePlan,
} from "@/lib/shared/contracts/licensing";
import { cn } from "@/lib/utils";
import { useEntitlements } from "@/modules/settings/hooks/useEntitlements";

const PLAN_LABELS: Record<LicensePlan, string> = {
  free: "Free",
  pro: "Pro",
  business: "Business",
};

function formatDate(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** One line explaining why the server is on the plan it reports. */
function describe(snapshot: EntitlementsSnapshot): {
  text: string;
  tone: "muted" | "warning";
} {
  switch (snapshot.status) {
    case "active":
      return {
        tone: "muted",
        text: snapshot.expiresAt
          ? `Licensed to ${snapshot.licensedTo} · renews ${formatDate(snapshot.expiresAt)}`
          : `Licensed to ${snapshot.licensedTo} · no expiry`,
      };
    case "expired":
      return {
        tone: "warning",
        text: snapshot.expiresAt
          ? `Licence expired on ${formatDate(snapshot.expiresAt)}`
          : "Licence expired",
      };
    case "invalid":
      return {
        tone: "warning",
        text: "Licence could not be verified — check HOMEIO_LICENSE",
      };
    case "unlicensed":
    default:
      return { tone: "muted", text: "No licence installed" };
  }
}

export function LicensePlanCard() {
  const { snapshot, isLoading } = useEntitlements();

  if (isLoading) {
    return (
      <div className="flex items-center justify-between gap-4 border-t border-glass-border/40 pt-2">
        <span className="text-[11px] text-muted-foreground/60">Plan</span>
        <span className="text-[11px] text-muted-foreground/40">Checking…</span>
      </div>
    );
  }

  const { text, tone } = describe(snapshot);
  const isPaid = snapshot.status === "active" && snapshot.plan !== "free";

  return (
    <div className="flex flex-col gap-1.5 border-t border-glass-border/40 pt-2">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[11px] text-muted-foreground">Plan</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
            isPaid
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground/80",
          )}
        >
          {isPaid ? <Sparkles className="size-3" /> : null}
          {PLAN_LABELS[snapshot.plan]}
        </span>
      </div>

      <div
        className={cn(
          "flex items-center gap-1 text-[11px]",
          tone === "warning"
            ? "text-status-amber"
            : "text-muted-foreground/70",
        )}
      >
        {tone === "warning" ? (
          <AlertTriangle className="size-3 shrink-0" />
        ) : null}
        <span className="truncate">{text}</span>
      </div>

      {snapshot.entitlements.length > 0 ? (
        <ul className="mt-0.5 flex flex-col gap-0.5">
          {snapshot.entitlements.map((entitlement) => (
            <li
              key={entitlement}
              className="text-[11px] text-muted-foreground/70"
            >
              · {ENTITLEMENT_LABELS[entitlement]}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
