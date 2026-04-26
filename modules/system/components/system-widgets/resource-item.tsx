import type { ResourceWidgetItem } from "@/modules/system/components/system-widgets/types";
import { ProgressBar } from "@/modules/system/components/system-widgets/progress-bar";

export function ResourceItem({
  icon: Icon,
  label,
  value,
  progress,
  colorClassName,
}: ResourceWidgetItem) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-4 items-center justify-center rounded-md bg-white/[0.07]">
            <Icon className="size-2.5 text-muted-foreground/70" />
          </div>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <span className="text-xs font-mono font-medium text-foreground">{value}</span>
      </div>
      <ProgressBar value={progress} colorClassName={colorClassName} />
    </div>
  );
}
