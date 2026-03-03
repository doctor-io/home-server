import { Activity } from "lucide-react";
import { ResourceItem } from "@/components/desktop/system-widgets/resource-item";
import type { ResourceWidgetItem } from "@/components/desktop/system-widgets/types";
import { WidgetCard } from "@/components/desktop/system-widgets/widget-card";

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
