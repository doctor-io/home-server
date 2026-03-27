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

type SecuritySectionProps = {
  data: SettingsBackend["security"];
  draft: SecuritySettingsDraft;
  onChange: (patch: Partial<SecuritySettingsDraft>) => void;
};

export function SecuritySection({
  data,
  draft,
  onChange,
}: SecuritySectionProps) {
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
        disabled={data.isLoading || data.isSaving}
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
        disabled={data.isLoading || data.isSaving}
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
        disabled={data.isLoading || data.isSaving}
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
        disabled={data.isLoading || data.isSaving}
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
        disabled={data.isLoading || data.isSaving}
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
        disabled={data.isLoading || data.isSaving}
      />
    </div>
  );
}
