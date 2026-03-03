"use client";

import { NetworkCard } from "@/components/desktop/system-widgets/network-card";
import { QuickStatsCard } from "@/components/desktop/system-widgets/quick-stats-card";
import { ResourcesCard } from "@/components/desktop/system-widgets/resources-card";
import { UptimeCard } from "@/components/desktop/system-widgets/uptime-card";
import { useSystemWidgetsData } from "@/components/desktop/system-widgets/use-system-widgets-data";

export function SystemWidgets() {
  const model = useSystemWidgetsData();

  return (
    <aside className="hidden xl:flex flex-col gap-3 w-72 pr-6 pt-4 pb-6 flex-shrink-0">
      <UptimeCard uptime={model.uptime} />
      <ResourcesCard items={model.resources} />
      <NetworkCard network={model.network} />
      <QuickStatsCard stats={model.quickStats} />
    </aside>
  );
}
