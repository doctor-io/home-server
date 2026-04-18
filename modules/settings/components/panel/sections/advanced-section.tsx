"use client";

import { LogsSection } from "@/modules/settings/components/panel/sections/logs-section";

export function AdvancedSection() {
  return (
    <div className="flex flex-col gap-1">
      <LogsSection />
    </div>
  );
}
