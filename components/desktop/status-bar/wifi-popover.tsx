"use client";

import { PopoverShell } from "@/components/desktop/status-bar/popover-shell";
import type { WifiPopoverProps } from "@/components/desktop/status-bar/types";
import {
  Check,
  Lock,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Wifi,
} from "lucide-react";

function WifiStrengthIcon({ quality }: { quality: number | null }) {
  if (quality === null)
    return <SignalLow className="size-4 text-muted-foreground" />;
  if (quality >= 70) return <SignalHigh className="size-4 text-status-green" />;
  if (quality >= 40)
    return <SignalMedium className="size-4 text-status-amber" />;
  return <SignalLow className="size-4 text-status-red" />;
}

export function WifiPopover({ metrics, onClose }: WifiPopoverProps) {
  const wifi = metrics?.wifi;
  const hasNetworks = (wifi?.availableNetworks.length ?? 0) > 0;

  return (
    <PopoverShell onClose={onClose} className="w-72">
      <div className="flex items-center justify-between p-3 border-b border-glass-border">
        <div className="flex items-center gap-2">
          <Wifi className="size-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Wi-Fi</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {wifi?.connected ? "Connected" : "Disconnected"}
        </span>
      </div>

      <div className="p-3 border-b border-glass-border/60">
        {wifi ? (
          <>
            <div className="flex items-center gap-2">
              <WifiStrengthIcon quality={wifi.signalPercent} />
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">
                  {wifi.ssid ?? "No active Wi-Fi network"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {wifi.iface
                    ? `Interface ${wifi.iface}`
                    : "Interface unavailable"}
                </p>
              </div>
              {wifi.connected && (
                <Check className="size-4 text-primary shrink-0" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-muted-foreground">
              <span className="truncate">IPv4: {wifi.ipv4 ?? "--"}</span>
              <span className="truncate">
                Signal: {wifi.signalPercent ?? "--"}%
              </span>
              <span className="truncate">IPv6: {wifi.ipv6 ?? "--"}</span>
              <span className="truncate">
                Tx: {wifi.txRateMbps ?? "--"} Mbps
              </span>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Loading network details...
          </p>
        )}
      </div>

      <div className="py-1 max-h-64 overflow-y-auto">
        <p className="px-3 pt-1 pb-1 text-xs text-muted-foreground uppercase tracking-wider">
          Nearby Networks
        </p>
        {hasNetworks ? (
          wifi?.availableNetworks.map((network, idx) => (
            <div
              key={`${network.ssid}-${network.channel ?? "na"}-${idx}`}
              className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-secondary/60 transition-colors text-left"
            >
              <WifiStrengthIcon quality={network.qualityPercent} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-foreground truncate">
                    {network.ssid}
                  </span>
                  {network.security ? (
                    <Lock className="size-3 text-muted-foreground shrink-0" />
                  ) : null}
                </div>
                <span className="text-xs text-muted-foreground">
                  Ch {network.channel ?? "--"} ·{" "}
                  {network.qualityPercent ?? "--"}%
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="px-3 py-5 text-center text-xs text-muted-foreground">
            No Wi-Fi scan data available
          </div>
        )}
      </div>
    </PopoverShell>
  );
}
