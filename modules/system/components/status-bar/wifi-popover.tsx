"use client";

import { useMemo, useState } from "react";
import { PopoverShell } from "@/modules/system/components/status-bar/popover-shell";
import type { WifiPopoverProps } from "@/modules/system/components/status-bar/types";
import {
  EthernetIcon,
  WifiSignalIcon,
  WifiStatusIcon,
} from "@/modules/system/components/status-bar/wifi-icons";
import { useNetworkActions } from "@/modules/system/hooks/useNetworkActions";
import { useWifiNetworks } from "@/modules/system/hooks/useWifiNetworks";
import {
  Check,
  Lock,
} from "@/components/icons/platform-icons";
import type { WifiAccessPoint } from "@/lib/shared/contracts/network";

function WifiStrengthIcon({ quality }: { quality: number | null }) {
  if (quality === null) {
    return <WifiSignalIcon quality={quality} className="size-4 text-muted-foreground" />;
  }
  if (quality >= 70) {
    return <WifiSignalIcon quality={quality} className="size-4 text-status-green" />;
  }
  if (quality >= 40)
    return <WifiSignalIcon quality={quality} className="size-4 text-status-amber" />;
  return <WifiSignalIcon quality={quality} className="size-4 text-status-red" />;
}

export function WifiPopover({ metrics, networkStatus, isDemoMode = false, onClose }: WifiPopoverProps) {
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
  const isEthernet = Boolean(status.connected && !status.ssid);

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
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-glass-border">
        <div className="flex items-center gap-2">
          {isEthernet ? (
            <EthernetIcon className="size-4 text-primary" />
          ) : (
            <WifiStatusIcon
              connected={status.connected}
              quality={status.signalPercent}
              className={status.connected ? "size-4 text-primary" : "size-4 text-status-red"}
            />
          )}
          <span className="text-sm font-semibold text-foreground">
            {isEthernet ? "Ethernet" : "Wi-Fi"}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {status.connected ? "Connected" : "Disconnected"}
        </span>
      </div>

      {/* Status body */}
      <div className="p-3 border-b border-glass-border/60">
        {hasStatus ? (
          <>
            <div className="flex items-center gap-2">
              {isEthernet ? (
                <EthernetIcon className="size-4 text-status-green" />
              ) : (
                <WifiStrengthIcon quality={status.signalPercent} />
              )}
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">
                  {isEthernet
                    ? (status.iface ?? "Ethernet")
                    : (status.ssid ?? "No active Wi-Fi network")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isEthernet
                    ? "Wired connection"
                    : status.iface
                      ? `Interface ${status.iface}`
                      : "Interface unavailable"}
                </p>
              </div>
              {status.connected && (
                <Check className="size-4 text-primary shrink-0" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-muted-foreground">
              {!isDemoMode && <span className="truncate">IPv4: {status.ipv4 ?? "--"}</span>}
              {!isEthernet && (
                <span className="truncate">
                  Signal: {status.signalPercent ?? "--"}%
                </span>
              )}
              <span className="truncate">
                Download: {metrics?.wifi.downloadMbps ?? "--"} Mbps
              </span>
              <span className="truncate">
                Upload: {metrics?.wifi.uploadMbps ?? "--"} Mbps
              </span>
            </div>
            {!isEthernet && (
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
            )}
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

      {/* Nearby networks — only shown for Wi-Fi */}
      {!isEthernet && (
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
                  className="text-2xs px-2 py-1 rounded-md border border-glass-border text-foreground hover:bg-secondary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
      )}
    </PopoverShell>
  );
}
