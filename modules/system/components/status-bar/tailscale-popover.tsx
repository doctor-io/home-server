"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Tailscale, X } from "@/components/icons/platform-icons";
import { queryKeys } from "@/lib/shared/query-keys";
import type {
  TailscaleConfigPublic,
  TailscaleStatusPublic,
} from "@/lib/shared/contracts/tailscale";
import { PopoverShell } from "@/modules/system/components/status-bar/popover-shell";
import { cn } from "@/lib/utils";

type TailscalePopoverProps = {
  onClose: () => void;
};

async function fetchTailscaleConfig(): Promise<TailscaleConfigPublic> {
  const res = await fetch("/api/v1/settings/tailscale", { cache: "no-store" });
  const json = (await res.json()) as { data?: TailscaleConfigPublic; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Failed to fetch Tailscale config");
  return json.data!;
}

async function fetchTailscaleStatus(): Promise<TailscaleStatusPublic> {
  const res = await fetch("/api/v1/system/tailscale/status", { cache: "no-store" });
  const json = (await res.json()) as { data?: TailscaleStatusPublic; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Failed to fetch Tailscale status");
  return json.data!;
}

export function TailscalePopover({ onClose }: TailscalePopoverProps) {
  const { data: config } = useQuery({
    queryKey: queryKeys.tailscaleConfig,
    queryFn: fetchTailscaleConfig,
  });
  const { data: status, isLoading, error } = useQuery({
    queryKey: queryKeys.tailscaleStatus,
    queryFn: fetchTailscaleStatus,
    refetchInterval: 30_000,
  });

  const configured = Boolean(config?.tailnet && config.hasApiKey);
  const connected = Boolean(status?.connected);
  const installed = Boolean(status?.installed);
  const missingTun = status?.issue === "missing_tun";
  const title = connected
    ? "Tailscale Connected"
    : missingTun
      ? "Tailscale Needs TUN"
      : installed
      ? "Tailscale Not Connected"
      : "Tailscale Not Installed";

  return (
    <PopoverShell onClose={onClose} className="w-72">
      <div className="p-4">
        <div className="mb-4 flex items-center gap-3">
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-xl",
              connected ? "bg-status-green/15" : "bg-muted/35",
            )}
          >
            <Tailscale
              className={cn(
                "size-5",
                connected ? "text-status-green" : "text-muted-foreground",
              )}
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">
              {configured ? "Credentials configured" : "Credentials not configured"}
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          <StatusRow label="Tailnet" value={config?.tailnet || "--"} />
          <StatusRow
            label="Service"
            value={isLoading ? "Checking..." : installed ? "Installed" : "Not installed"}
            ok={installed}
          />
          <StatusRow
            label="Connection"
            value={isLoading ? "Checking..." : connected ? "Connected" : "Disconnected"}
            ok={connected}
          />
          <StatusRow
            label="TUN"
            value={status?.tunAvailable ? "Available" : "Missing"}
            ok={status?.tunAvailable}
          />
          <StatusRow label="State" value={status?.backendState ?? "--"} />
          <StatusRow label="Machine" value={status?.hostname ?? "--"} />
          <StatusRow label="DNS" value={status?.dnsName ?? "--"} />
          <StatusRow label="IP" value={status?.tailscaleIps[0] ?? "--"} />
        </div>

        {missingTun && (
          <div className="mt-4 rounded-lg border border-status-amber/25 bg-status-amber/10 px-3 py-2 text-xs text-status-amber">
            Proxmox LXC must expose dev/net/tun before Tailscale can start.
          </div>
        )}

        {(status?.error || error) && !missingTun && (
          <div className="mt-4 rounded-lg border border-status-amber/25 bg-status-amber/10 px-3 py-2 text-xs text-status-amber">
            {status?.error ?? (error instanceof Error ? error.message : "Unable to read Tailscale status.")}
          </div>
        )}

        {!installed && (
          <div className="mt-3 rounded-lg bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
            Install support will use the official Tailscale Linux installer and then connect this server to your tailnet.
          </div>
        )}
      </div>
    </PopoverShell>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground/70">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-right font-mono text-xs text-foreground/80">
        {typeof ok === "boolean" && (
          ok ? (
            <CheckCircle2 className="size-3 text-status-green" />
          ) : (
            <X className="size-3 text-muted-foreground" />
          )
        )}
        <span className="truncate">{value}</span>
      </span>
    </div>
  );
}
