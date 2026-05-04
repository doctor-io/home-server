import { CalendarClock } from "@/components/icons/platform-icons";
import type { UptimeParts } from "@/modules/system/components/system-widgets/types";
import { WidgetCard } from "@/modules/system/components/system-widgets/widget-card";

type UptimeCardProps = {
  uptime: UptimeParts;
};

export function UptimeCard({ uptime }: UptimeCardProps) {
  return (
    <WidgetCard title="Uptime" icon={CalendarClock}>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-primary font-mono">{uptime.days}</span>
        <span className="text-xs text-muted-foreground mr-2">d</span>
        <span className="text-2xl font-bold text-foreground font-mono">{uptime.hours}</span>
        <span className="text-xs text-muted-foreground mr-2">h</span>
        <span className="text-2xl font-bold text-foreground/70 font-mono">{uptime.minutes}</span>
        <span className="text-xs text-muted-foreground">m</span>
      </div>
    </WidgetCard>
  );
}
