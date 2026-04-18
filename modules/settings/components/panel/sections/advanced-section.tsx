"use client";

import { SectionDivider, Toggle } from "@/modules/settings/components/panel/controls";
import { LogsSection } from "@/modules/settings/components/panel/sections/logs-section";
import { useTelemetry } from "@/modules/settings/hooks/useTelemetry";

export function AdvancedSection() {
  const { enabled, isLoading, toggle } = useTelemetry();

  return (
    <div className="flex flex-col gap-1">
      <LogsSection />

      <SectionDivider title="Telemetry" />
      <Toggle
        label="Anonymous usage data"
        description="Send a one-time anonymous ping on startup — version, architecture, and a random instance ID. No personal data, no file paths, no app names."
        enabled={enabled}
        onToggle={toggle}
        disabled={isLoading}
      />
    </div>
  );
}
