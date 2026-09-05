"use client";

import { NetworkCard } from "@/modules/system/components/system-widgets/network-card";
import { QuickStatsCard } from "@/modules/system/components/system-widgets/quick-stats-card";
import { ResourcesCard } from "@/modules/system/components/system-widgets/resources-card";
import { UptimeCard } from "@/modules/system/components/system-widgets/uptime-card";
import { useSystemWidgetsData } from "@/modules/system/components/system-widgets/use-system-widgets-data";

export function SystemWidgets() {
  const model = useSystemWidgetsData();

  return (
    <aside className="hidden min-h-0 w-72 shrink-0 flex-col gap-2.5 overflow-y-auto pr-6 pt-3 pb-4 xl:flex">
      <UptimeCard uptime={model.uptime} />
      <ResourcesCard items={model.resources} />
      <NetworkCard network={model.network} />
      <QuickStatsCard stats={model.quickStats} />
    </aside>
  );
}
