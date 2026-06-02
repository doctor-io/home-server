"use client";

import { InfoBanner, SectionDivider } from "@/modules/settings/components/panel/controls";
import { SETTINGS_PANEL_INSET } from "@/modules/settings/components/panel/surface";
import { TwoFactorCard } from "@/modules/settings/components/panel/sections/two-factor-card";
import { Plus } from "@/components/icons/platform-icons";
import type { TwoFactorStatus } from "@/lib/shared/contracts/auth";
import { cn } from "@/lib/utils";

type UsersSectionProps = {
  username: string;
  twoFactor: TwoFactorStatus;
  isDemoMode?: boolean;
};

export function UsersSection({
  username,
  twoFactor,
  isDemoMode = false,
}: UsersSectionProps) {
  const initial = username.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col gap-1">
      <InfoBanner
        text="Homeio is currently single-user. Multi-user access is planned for a future release."
        variant="info"
      />

      <SectionDivider title="User Accounts" />
      <div className={cn(SETTINGS_PANEL_INSET, "overflow-hidden")}>
        <div className="flex items-center gap-3 px-4 py-3">
          <div
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
            style={{ backgroundColor: "oklch(0.55 0.15 190)" }}
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{username}</span>
              <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                Admin
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground/70">Local account · Current session</div>
          </div>
        </div>
      </div>

      <TwoFactorCard status={twoFactor} isDemoMode={isDemoMode} />

      <SectionDivider title="Access" />
      <div className={cn(SETTINGS_PANEL_INSET, "flex items-center justify-between gap-4 px-4 py-3")}>
        <div className="min-w-0">
          <div className="text-sm text-foreground">Add user</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground/70">Multi-user support is coming soon</div>
        </div>
        <button
          disabled
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="size-3" />
          Add User
          <span className="rounded bg-primary/20 px-1 py-px text-[10px] font-semibold uppercase tracking-wide">
            Soon
          </span>
        </button>
      </div>
    </div>
  );
}
