import {
    InfoBanner,
    SectionDivider,
} from "@/modules/settings/components/panel/controls";
import { SETTINGS_PANEL_INSET } from "@/modules/settings/components/panel/surface";
import type { SettingsBackend } from "@/modules/settings/components/panel/types";

type NetworkSectionProps = {
  data: SettingsBackend["network"];
};

export function NetworkSection({ data }: NetworkSectionProps) {
  return (
    <div className="flex flex-col gap-1">
      {data.warning ? (
        <InfoBanner
          text={data.warning}
          variant={data.unavailable ? "warning" : "info"}
        />
      ) : null}
      <SectionDivider title="Interfaces" />
      <div className={`${SETTINGS_PANEL_INSET} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-glass-border/80 p-3">
          <div className="flex items-center gap-3">
            <div
              className={`size-2 rounded-[var(--radius)] ${
                data.connected ? "bg-status-green" : "bg-muted-foreground/50"
              }`}
            />
            <div>
              <span className="text-sm text-foreground font-medium">
                {data.iface}
              </span>
              <span className="text-xs text-muted-foreground ml-2">
                {data.connected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            Signal {data.signalPercent}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4 p-3">
          <div>
            <span className="text-xs text-muted-foreground block">IPv4 Address</span>
            <span className="text-xs text-foreground font-mono">{data.ipv4}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">SSID</span>
            <span className="text-xs text-foreground font-mono">{data.ssid}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Wi-Fi Networks</span>
            <span className="text-xs text-foreground font-mono">{data.wifiCount}</span>
          </div>
        </div>
        {data.topSsids.length > 0 ? (
          <div className="px-3 pb-3 text-xs text-muted-foreground">
            Nearby: {data.topSsids.join(", ")}
          </div>
        ) : null}
      </div>

      <SectionDivider title="Configuration & Advanced" />
      <div className={`${SETTINGS_PANEL_INSET} px-4 py-3`}>
        <p className="text-xs text-muted-foreground">
          Network configuration (Gateway, DNS, DHCP, IPv6, MTU, Wake-on-LAN) and port forwarding are coming in a future update.
        </p>
      </div>
    </div>
  );
}
