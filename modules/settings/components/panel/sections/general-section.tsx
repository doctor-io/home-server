import { Cpu, MemoryStick, MonitorSpeaker, Thermometer } from "@/components/icons/platform-icons";
import {
  InfoBanner,
  SectionDivider,
  SettingsInput,
  SettingsSelect,
} from "@/modules/settings/components/panel/controls";
import type { SettingsBackend } from "@/modules/settings/components/panel/types";

type GeneralSectionProps = {
  data: SettingsBackend["general"];
  preferences: SettingsBackend["generalPreferences"] & {
    hostname: string;
    timezone: string;
  };
  capabilities: SettingsBackend["capabilities"]["general"];
  languageValue: string;
  languageOptions: string[];
  onHostnameChange: (value: string) => void;
  onTimezoneChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
};

export function GeneralSection({
  data,
  preferences,
  capabilities,
  languageValue,
  languageOptions,
  onHostnameChange,
  onTimezoneChange,
  onLanguageChange,
}: GeneralSectionProps) {
  return (
    <div className="flex flex-col gap-1">
      {data.warning ? (
        <InfoBanner
          text={data.warning}
          variant={data.unavailable ? "warning" : "info"}
        />
      ) : null}
      <SectionDivider title="System Info" />
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 py-2">
        <div className="flex flex-col gap-0.5 py-1.5">
          <span className="text-xs text-muted-foreground">Hostname</span>
          <span className="text-sm text-foreground font-medium">
            {data.hostname}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 py-1.5">
          <span className="text-xs text-muted-foreground">OS</span>
          <span className="text-sm text-foreground">{data.platform}</span>
        </div>
        <div className="flex flex-col gap-0.5 py-1.5">
          <span className="text-xs text-muted-foreground">Kernel</span>
          <span className="text-sm text-foreground font-mono text-xs">
            {data.kernel}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 py-1.5">
          <span className="text-xs text-muted-foreground">Architecture</span>
          <span className="text-sm text-foreground">{data.architecture}</span>
        </div>
        <div className="flex flex-col gap-0.5 py-1.5">
          <span className="text-xs text-muted-foreground">Uptime</span>
          <span className="text-sm text-foreground">{data.uptime}</span>
        </div>
        <div className="flex flex-col gap-0.5 py-1.5">
          <span className="text-xs text-muted-foreground">
            Homeio Version
          </span>
          <span className="text-sm text-foreground">{data.appVersion}</span>
        </div>
      </div>

      <SectionDivider title="Hardware" />
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 py-2">
        <div className="flex items-center gap-2 py-1.5">
          <Cpu className="size-4 text-primary" />
          <div>
            <span className="text-xs text-muted-foreground block">
              Processor
            </span>
            <span className="text-xs text-foreground">{data.cpuSummary}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 py-1.5">
          <MemoryStick className="size-4 text-primary" />
          <div>
            <span className="text-xs text-muted-foreground block">Memory</span>
            <span className="text-xs text-foreground">
              {data.memorySummary}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 py-1.5">
          <Thermometer className="size-4 text-status-amber" />
          <div>
            <span className="text-xs text-muted-foreground block">
              CPU Temperature
            </span>
            <span className="text-xs text-foreground">
              {data.temperatureSummary}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 py-1.5">
          <MonitorSpeaker className="size-4 text-primary" />
          <div>
            <span className="text-xs text-muted-foreground block">User</span>
            <span className="text-xs text-foreground">
              {data.username} ({data.processUptime})
            </span>
          </div>
        </div>
      </div>

      <SectionDivider title="Preferences" />
      {preferences.error ? (
        <InfoBanner text={preferences.error} variant="warning" />
      ) : null}
      <SettingsInput
        label="Hostname"
        value={preferences.hostname}
        onChange={onHostnameChange}
        description="Applies immediately with hostnamectl."
        disabled={capabilities.hostname.disabled}
        disabledReason={capabilities.hostname.disabledReason}
      />
      <SettingsSelect
        label="Timezone"
        value={preferences.timezone}
        options={preferences.timezoneOptions}
        onChange={onTimezoneChange}
        description="Applies immediately with timedatectl."
        disabled={capabilities.timezone.disabled}
        disabledReason={capabilities.timezone.disabledReason}
      />
      <SettingsSelect
        label="Language"
        value={languageValue}
        options={languageOptions}
        onChange={onLanguageChange}
        description="Saved locally for Homeio UI preference only."
        disabled={capabilities.language.disabled}
        disabledReason={capabilities.language.disabledReason}
      />
    </div>
  );
}
