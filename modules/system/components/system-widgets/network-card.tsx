import { Activity, ArrowDown, ArrowUp } from "@/components/icons/platform-icons";
import type { NetworkWidgetData } from "@/modules/system/components/system-widgets/types";
import { WidgetCard } from "@/modules/system/components/system-widgets/widget-card";

type NetworkCardProps = {
  network: NetworkWidgetData;
};

export function NetworkCard({ network }: NetworkCardProps) {
  return (
    <WidgetCard title="Network" icon={Activity}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-4 items-center justify-center rounded-md bg-status-green/15">
              <ArrowDown className="size-2.5 text-status-green" />
            </div>
            <span className="text-xs text-muted-foreground">Download</span>
          </div>
          <span className="text-sm font-mono font-semibold text-status-green">
            {network.downloadText}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-4 items-center justify-center rounded-md bg-primary/12">
              <ArrowUp className="size-2.5 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">Upload</span>
          </div>
          <span className="text-sm font-mono font-semibold text-primary">
            {network.uploadText}
          </span>
        </div>

        <div className="h-px bg-white/[0.07]" />

        <DetailRow label="SSID" value={network.ssid} />
        <DetailRow label="Interface" value={network.interfaceName} />
        {!network.isDemoMode && (
          <DetailRow label="Local IP" value={network.ipAddress} />
        )}
        <DetailRow label="Hostname" value={network.hostname} />
      </div>
    </WidgetCard>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground/70">{label}</span>
      <span className="text-xs font-mono text-foreground/80">{value}</span>
    </div>
  );
}
