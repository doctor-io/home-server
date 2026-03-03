import { Activity, ArrowDown, ArrowUp } from "lucide-react";
import type { NetworkWidgetData } from "@/components/desktop/system-widgets/types";
import { WidgetCard } from "@/components/desktop/system-widgets/widget-card";

type NetworkCardProps = {
  network: NetworkWidgetData;
};

export function NetworkCard({ network }: NetworkCardProps) {
  return (
    <WidgetCard title="Network" icon={Activity}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowDown className="size-3.5 text-status-green" />
            <span className="text-xs text-muted-foreground">Download</span>
          </div>
          <span className="text-sm font-mono font-medium text-foreground">
            {network.downloadText}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowUp className="size-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">Upload</span>
          </div>
          <span className="text-sm font-mono font-medium text-foreground">
            {network.uploadText}
          </span>
        </div>

        <div className="h-px bg-border" />

        <DetailRow label="SSID" value={network.ssid} />
        <DetailRow label="Interface" value={network.interfaceName} />
        <DetailRow label="Local IP" value={network.ipAddress} />
        <DetailRow label="Hostname" value={network.hostname} />
      </div>
    </WidgetCard>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-mono text-foreground">{value}</span>
    </div>
  );
}
