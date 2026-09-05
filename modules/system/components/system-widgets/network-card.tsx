import { ArrowDown, ArrowUp, Network } from "@/components/icons/platform-icons";
import type { NetworkWidgetData } from "@/modules/system/components/system-widgets/types";
import { WidgetCard } from "@/modules/system/components/system-widgets/widget-card";

type NetworkCardProps = {
  network: NetworkWidgetData;
};

export function NetworkCard({ network }: NetworkCardProps) {
  return (
    <WidgetCard title="Network" icon={Network}>
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

        {/* Reference values, not live metrics — they get their own tighter
            rhythm so four of them do not cost as much height as the two
            throughput rows above. */}
        <div className="flex flex-col gap-1.5">
          <DetailRow label="SSID" value={network.ssid} />
          <DetailRow label="Interface" value={network.interfaceName} />
          {!network.isDemoMode && (
            <DetailRow label="Local IP" value={network.ipAddress} />
          )}
          <DetailRow label="Hostname" value={network.hostname} />
        </div>
      </div>
    </WidgetCard>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3">
      <span className="shrink-0 text-xs text-muted-foreground/70">{label}</span>
      {/* A long hostname used to wrap onto a second line and collide with its
          own label. The full value stays available on hover. */}
      <span
        className="truncate text-right text-xs font-mono text-foreground/80"
        title={value}
      >
        {value}
      </span>
    </div>
  );
}
