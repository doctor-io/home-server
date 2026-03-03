"use client";

import { useMemo, useState } from "react";
import { PopoverShell } from "@/components/desktop/status-bar/popover-shell";
import type { WifiPopoverProps } from "@/components/desktop/status-bar/types";
import { useNetworkActions } from "@/hooks/useNetworkActions";
import { useWifiNetworks } from "@/hooks/useWifiNetworks";
import {
  Check,
  Lock,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Wifi,
} from "lucide-react";
import type { WifiAccessPoint } from "@/lib/shared/contracts/network";

function WifiStrengthIcon({ quality }: { quality: number | null }) {
  if (quality === null)
    return <SignalLow className="size-4 text-muted-foreground" />;
  if (quality >= 70) return <SignalHigh className="size-4 text-status-green" />;
  if (quality >= 40)
    return <SignalMedium className="size-4 text-status-amber" />;
  return <SignalLow className="size-4 text-status-red" />;
}

export function WifiPopover({ metrics, networkStatus, onClose }: WifiPopoverProps) {
  const { data: networksFromApi } = useWifiNetworks();
  const {
    connectNetwork,
    disconnectNetwork,
    isConnecting,
    isDisconnecting,
    actionError,
  } = useNetworkActions();
  const [pendingSsid, setPendingSsid] = useState<string | null>(null);

  const fallbackNetworks = useMemo<WifiAccessPoint[]>(
    () =>
      (metrics?.wifi.availableNetworks ?? []).map((network) => ({
        ssid: network.ssid,
        bssid: null,
        signalPercent: network.qualityPercent,
        channel: network.channel,
        frequencyMhz: null,
        security: network.security,
      })),
    [metrics?.wifi.availableNetworks],
  );

  const status = networkStatus ?? {
    connected: Boolean(metrics?.wifi.connected),
    iface: metrics?.wifi.iface ?? null,
    ssid: metrics?.wifi.ssid ?? null,
    ipv4: metrics?.wifi.ipv4 ?? null,
    signalPercent: metrics?.wifi.signalPercent ?? null,
  };
  const hasStatus = Boolean(networkStatus || metrics);

  const networks = (networksFromApi?.length ?? 0) > 0 ? networksFromApi : fallbackNetworks;
  const hasNetworks = networks.length > 0;

  async function handleConnect(network: WifiAccessPoint) {
    try {
      setPendingSsid(network.ssid);
      const password =
        network.security && network.security.length > 0
          ? window.prompt(`Password for ${network.ssid}`) ?? ""
          : undefined;

      if (network.security && (!password || password.trim().length === 0)) {
        return;
      }

      await connectNetwork({
        ssid: network.ssid,
        password,
      });
    } finally {
      setPendingSsid(null);
    }
  }

  async function handleDisconnect() {
    await disconnectNetwork({
      iface: status.iface ?? undefined,
    });
  }

  return (
    <PopoverShell onClose={onClose} className="w-72">
      <div className="flex items-center justify-between p-3 border-b border-glass-border">
        <div className="flex items-center gap-2">
          <Wifi className="size-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Wi-Fi</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {status.connected ? "Connected" : "Disconnected"}
        </span>
      </div>

      <div className="p-3 border-b border-glass-border/60">
        {hasStatus ? (
          <>
            <div className="flex items-center gap-2">
              <WifiStrengthIcon quality={status.signalPercent} />
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">
                  {status.ssid ?? "No active Wi-Fi network"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {status.iface
                    ? `Interface ${status.iface}`
                    : "Interface unavailable"}
                </p>
              </div>
              {status.connected && (
                <Check className="size-4 text-primary shrink-0" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-muted-foreground">
              <span className="truncate">IPv4: {status.ipv4 ?? "--"}</span>
              <span className="truncate">
                Signal: {status.signalPercent ?? "--"}%
              </span>
              <span className="truncate">
                Download: {metrics?.wifi.downloadMbps ?? "--"} Mbps
              </span>
              <span className="truncate">
                Upload: {metrics?.wifi.uploadMbps ?? "--"} Mbps
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={!status.connected || isDisconnecting}
                className="text-xs px-2.5 py-1.5 rounded-md border border-glass-border text-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-secondary/50 transition-colors"
              >
                {isDisconnecting ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Loading network details...
          </p>
        )}
        {actionError ? (
          <p className="text-xs text-status-red mt-2">{actionError.message}</p>
        ) : null}
      </div>

      <div className="py-1 max-h-64 overflow-y-auto">
        <p className="px-3 pt-1 pb-1 text-xs text-muted-foreground uppercase tracking-wider">
          Nearby Networks
        </p>
        {hasNetworks ? (
          networks.map((network, idx) => (
            <div
              key={`${network.ssid}-${network.channel ?? "na"}-${idx}`}
              className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-secondary/60 transition-colors text-left"
            >
              <WifiStrengthIcon quality={network.signalPercent} />
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
                  {network.signalPercent ?? "--"}%
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  void handleConnect(network);
                }}
                disabled={isConnecting && pendingSsid === network.ssid}
                className="text-[11px] px-2 py-1 rounded-md border border-glass-border text-foreground hover:bg-secondary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting && pendingSsid === network.ssid
                  ? "Connecting..."
                  : status.ssid === network.ssid && status.connected
                    ? "Connected"
                    : "Connect"}
              </button>
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
