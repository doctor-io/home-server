import { Activity } from "@/components/icons/platform-icons";
import { ResourceItem } from "@/modules/system/components/system-widgets/resource-item";
import type { ResourceWidgetItem } from "@/modules/system/components/system-widgets/types";
import { WidgetCard } from "@/modules/system/components/system-widgets/widget-card";

type ResourcesCardProps = {
  items: ResourceWidgetItem[];
};

export function ResourcesCard({ items }: ResourcesCardProps) {
  return (
    <WidgetCard title="Resources" icon={Activity}>
      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <ResourceItem key={item.label} {...item} />
        ))}
      </div>
    </WidgetCard>
  );
}
