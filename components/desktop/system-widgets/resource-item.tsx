import type { ResourceWidgetItem } from "@/components/desktop/system-widgets/types";
import { ProgressBar } from "@/components/desktop/system-widgets/progress-bar";

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
          <Icon className="size-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <span className="text-xs font-mono font-medium text-foreground">{value}</span>
      </div>
      <ProgressBar value={progress} colorClassName={colorClassName} />
    </div>
  );
}
