"use client";

import { InfoBanner, SectionDivider } from "@/modules/settings/components/panel/controls";
import { SETTINGS_PANEL_INSET } from "@/modules/settings/components/panel/surface";
import type { SettingsBackend } from "@/modules/settings/components/panel/types";
import { cn } from "@/lib/utils";

type NetworkSectionProps = {
  data: SettingsBackend["network"];
};

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("truncate text-right text-xs font-medium text-foreground", mono && "font-mono")}>
        {value}
      </span>
    </div>
  );
}

export function NetworkSection({ data }: NetworkSectionProps) {
  const isEthernet = data.connected && data.ssid === "--";

  return (
    <div className="flex flex-col gap-1">
      {data.warning && (
        <InfoBanner text={data.warning} variant={data.unavailable ? "warning" : "info"} />
      )}

      <SectionDivider title="Interface" />
      <div className={cn(SETTINGS_PANEL_INSET, "overflow-hidden")}>
        {/* Status header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "size-2 rounded-full",
              data.connected ? "bg-status-green" : "bg-muted-foreground/40",
            )} />
            <span className="text-sm font-medium text-foreground">{data.iface}</span>
            <span className="text-xs text-muted-foreground">
              {data.connected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {isEthernet ? "Ethernet" : `Signal ${data.signalPercent}`}
          </span>
        </div>

        {/* Detail rows */}
        <div className="divide-y divide-glass-border/50 border-t border-glass-border/50 px-4">
          <InfoRow label="IPv4 Address" value={data.ipv4} mono />
          {isEthernet ? (
            <InfoRow label="Connection type" value="Wired Ethernet" />
          ) : (
            <>
              <InfoRow label="SSID" value={data.ssid} mono />
              <InfoRow label="Nearby networks" value={String(data.wifiCount)} />
              {data.topSsids.length > 0 && (
                <div className="py-2.5">
                  <span className="text-xs text-muted-foreground">Nearby SSIDs</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {data.topSsids.map((ssid) => (
                      <span
                        key={ssid}
                        className="rounded-md border border-glass-border bg-background/50 px-2 py-0.5 font-mono text-[11px] text-foreground/80"
                      >
                        {ssid}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <SectionDivider title="Advanced" />
      <div className={cn(SETTINGS_PANEL_INSET, "px-4 py-3")}>
        <p className="text-xs text-muted-foreground">
          Gateway, DNS, DHCP, IPv6, MTU, and Wake-on-LAN configuration is coming in a future update.
        </p>
      </div>
    </div>
  );
}
