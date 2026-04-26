import type { QuickStatItem } from "@/modules/system/components/system-widgets/types";
import { WidgetCard } from "@/modules/system/components/system-widgets/widget-card";

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
            className="flex flex-col items-center gap-0.5 rounded-xl border border-white/[0.07] bg-white/[0.04] py-2.5"
          >
            <span className="text-base leading-tight font-bold text-foreground font-mono">
              {item.value}
            </span>
            <span className="text-2xs leading-tight text-muted-foreground/80 uppercase tracking-wider">
              {item.label}
            </span>
            <span className="text-2xs leading-tight text-muted-foreground/50 text-center px-1.5 w-full truncate">
              {item.sub}
            </span>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
