"use client";

import { SectionDivider } from "@/modules/settings/components/panel/controls";
import { LogsSection } from "@/modules/settings/components/panel/sections/logs-section";
import { ServerInfoSection } from "@/modules/settings/components/panel/sections/server-info-section";

export function AdvancedSection() {
  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="Server Hardware" />
      <ServerInfoSection />

      <div className="mt-2">
        <SectionDivider title="Logs" />
        <LogsSection />
      </div>
    </div>
  );
}
