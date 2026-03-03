import { Clock } from "lucide-react";
import type { UptimeParts } from "@/components/desktop/system-widgets/types";
import { WidgetCard } from "@/components/desktop/system-widgets/widget-card";

type UptimeCardProps = {
  uptime: UptimeParts;
};

export function UptimeCard({ uptime }: UptimeCardProps) {
  return (
    <WidgetCard title="Uptime" icon={Clock}>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-foreground font-mono">{uptime.days}</span>
        <span className="text-xs text-muted-foreground mr-2">days</span>
        <span className="text-2xl font-bold text-foreground font-mono">{uptime.hours}</span>
        <span className="text-xs text-muted-foreground mr-2">hrs</span>
        <span className="text-2xl font-bold text-foreground font-mono">{uptime.minutes}</span>
        <span className="text-xs text-muted-foreground">min</span>
      </div>
    </WidgetCard>
  );
}
