import type { QuickStatItem } from "@/components/desktop/system-widgets/types";
import { WidgetCard } from "@/components/desktop/system-widgets/widget-card";

type QuickStatsCardProps = {
  stats: QuickStatItem[];
};

export function QuickStatsCard({ stats }: QuickStatsCardProps) {
  return (
    <WidgetCard className="p-3">
      <div className="grid grid-cols-2 gap-2">
        {stats.map((item) => (
          <div
            key={item.label}
            className="flex flex-col items-center gap-0 py-1.5 rounded-lg bg-glass-highlight"
          >
            <span className="text-base leading-tight font-bold text-foreground font-mono">
              {item.value}
            </span>
            <span className="text-[10px] leading-tight text-muted-foreground uppercase tracking-wider">
              {item.label}
            </span>
            <span className="text-[10px] leading-tight text-muted-foreground/70 text-center px-1.5 w-full truncate">
              {item.sub}
            </span>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
