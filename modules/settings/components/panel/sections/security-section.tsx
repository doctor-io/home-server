import {
  InfoBanner,
  SectionDivider,
  SettingsInput,
  SettingsSelect,
  Toggle,
} from "@/modules/settings/components/panel/controls";
import type {
  SecuritySettingsDraft,
  SettingsBackend,
} from "@/modules/settings/components/panel/types";
import type { SystemSecurityPolicy } from "@/lib/shared/contracts/system";
import { LockClosedRegular } from "@fluentui/react-icons";

type SecuritySectionProps = {
  data: SettingsBackend["security"];
  draft: SecuritySettingsDraft;
  isDemoMode?: boolean;
  onChange: (patch: Partial<SecuritySettingsDraft>) => void;
};

export function SecuritySection({
  data,
  draft,
  isDemoMode = false,
  onChange,
}: SecuritySectionProps) {
  const isDisabled = isDemoMode || data.isLoading || data.isSaving;

  if (isDemoMode) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-white/8 bg-white/[0.03] px-6 py-10 text-center">
          <span className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <LockClosedRegular className="size-5 text-muted-foreground" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">Security settings are locked</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Firewall and intrusion prevention controls are disabled in demo mode.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {data.error ? (
        <InfoBanner
          text={data.error}
          variant={data.unavailable ? "warning" : "info"}
        />
      ) : null}
      <SectionDivider title="Firewall" />
      <Toggle
        label="UFW Firewall"
        description="Uncomplicated Firewall for managing inbound/outbound rules"
        enabled={draft.firewallEnabled}
        onToggle={() =>
          onChange({
            firewallEnabled: !draft.firewallEnabled,
          })
        }
        disabled={isDisabled}
      />
      <SettingsSelect
        label="Default incoming policy"
        value={draft.firewallIncomingPolicy}
        options={data.firewall.policyOptions}
        onChange={(value) =>
          onChange({
            firewallIncomingPolicy: value as SystemSecurityPolicy,
          })
        }
        disabled={isDisabled}
      />
      <SettingsSelect
        label="Default outgoing policy"
        value={draft.firewallOutgoingPolicy}
        options={data.firewall.policyOptions}
        onChange={(value) =>
          onChange({
            firewallOutgoingPolicy: value as SystemSecurityPolicy,
          })
        }
        disabled={isDisabled}
      />

      <SectionDivider title="Intrusion Prevention" />
      <Toggle
        label="Fail2Ban"
        description="Automatically ban IPs with repeated failed login attempts"
        enabled={draft.fail2banEnabled}
        onToggle={() =>
          onChange({
            fail2banEnabled: !draft.fail2banEnabled,
          })
        }
        disabled={isDisabled}
      />
      <SettingsInput
        label="Max retries"
        value={draft.fail2banMaxRetries}
        description="Number of failed attempts before banning"
        onChange={(value) =>
          onChange({
            fail2banMaxRetries: value,
          })
        }
        disabled={isDisabled}
      />
      <SettingsInput
        label="Ban duration"
        value={draft.fail2banBanDurationSeconds}
        description="Ban time in seconds (3600 = 1 hour)"
        onChange={(value) =>
          onChange({
            fail2banBanDurationSeconds: value,
          })
        }
        disabled={isDisabled}
      />
    </div>
  );
}
