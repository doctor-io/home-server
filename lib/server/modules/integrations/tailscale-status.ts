import "server-only";

import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { promisify } from "node:util";
import type {
  TailscaleInstallResult,
  TailscaleStatusPublic,
} from "@/lib/shared/contracts/tailscale";

const execFileAsync = promisify(execFile);

async function hasTunDevice() {
  try {
    await access("/dev/net/tun");
    return true;
  } catch {
    return false;
  }
}

type TailscaleStatusJson = {
  BackendState?: string;
  Self?: {
    HostName?: string;
    DNSName?: string;
    TailscaleIPs?: string[];
    Online?: boolean;
  };
};

function isMissingCommand(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

async function toStatus(data: TailscaleStatusJson): Promise<TailscaleStatusPublic> {
  const backendState = data.BackendState ?? null;
  const connected = backendState === "Running" || data.Self?.Online === true;
  const tunAvailable = await hasTunDevice();

  return {
    installed: true,
    tunAvailable,
    running: backendState !== null && backendState !== "NoState",
    connected,
    backendState,
    hostname: data.Self?.HostName ?? null,
    dnsName: data.Self?.DNSName ?? null,
    tailscaleIps: data.Self?.TailscaleIPs ?? [],
    issue: tunAvailable ? null : "missing_tun",
    error: null,
  };
}

export async function getLocalTailscaleStatus(): Promise<TailscaleStatusPublic> {
  const tunAvailable = await hasTunDevice();

  try {
    const { stdout } = await execFileAsync("tailscale", ["status", "--json"], {
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });
    return toStatus(JSON.parse(stdout) as TailscaleStatusJson);
  } catch (error) {
    if (isMissingCommand(error)) {
      return {
        installed: false,
        tunAvailable,
        running: false,
        connected: false,
        backendState: null,
        hostname: null,
        dnsName: null,
        tailscaleIps: [],
        issue: tunAvailable ? null : "missing_tun",
        error: "Tailscale CLI is not installed.",
      };
    }

    const message = error instanceof Error ? error.message : "Unable to read Tailscale status.";
    const missingTun = !tunAvailable || message.includes("/dev/net/tun") || message.includes("CreateTUN");

    return {
      installed: true,
      tunAvailable,
      running: false,
      connected: false,
      backendState: null,
      hostname: null,
      dnsName: null,
      tailscaleIps: [],
      issue: missingTun ? "missing_tun" : "service_unavailable",
      error: message,
    };
  }
}

export async function installTailscale(authKey?: string): Promise<TailscaleInstallResult> {
  const currentStatus = await getLocalTailscaleStatus();
  let stdout = "";
  let stderr = "";

  if (!currentStatus.installed) {
    const installResult = await execFileAsync("sh", [
      "-c",
      "curl -fsSL https://tailscale.com/install.sh | sh",
    ], {
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
    });
    stdout += installResult.stdout;
    stderr += installResult.stderr;
  }

  const nextStatus = await getLocalTailscaleStatus();
  if (!nextStatus.tunAvailable) {
    throw new Error("Tailscale requires /dev/net/tun. In Proxmox LXC, pass through dev/net/tun before activating.");
  }

  if (!authKey) {
    return {
      installed: true,
      activated: nextStatus.connected,
      stdout,
      stderr: stderr || "Tailscale is installed. Provide an auth key to activate this server.",
    };
  }

  await execFileAsync("systemctl", ["reset-failed", "tailscaled"], { timeout: 10_000 });
  await execFileAsync("systemctl", ["enable", "--now", "tailscaled"], { timeout: 30_000 });

  const upResult = await execFileAsync("tailscale", [
    "up",
    `--auth-key=${authKey}`,
    "--accept-dns=true",
  ], {
    timeout: 120_000,
    maxBuffer: 1024 * 1024,
  });
  stdout += upResult.stdout;
  stderr += upResult.stderr;

  return {
    installed: true,
    activated: true,
    stdout,
    stderr,
  };
}
