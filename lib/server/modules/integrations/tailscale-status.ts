import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  TailscaleInstallResult,
  TailscaleStatusPublic,
} from "@/lib/shared/contracts/tailscale";

const execFileAsync = promisify(execFile);

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

function toStatus(data: TailscaleStatusJson): TailscaleStatusPublic {
  const backendState = data.BackendState ?? null;
  const connected = backendState === "Running" || data.Self?.Online === true;

  return {
    installed: true,
    running: backendState !== null && backendState !== "NoState",
    connected,
    backendState,
    hostname: data.Self?.HostName ?? null,
    dnsName: data.Self?.DNSName ?? null,
    tailscaleIps: data.Self?.TailscaleIPs ?? [],
    error: null,
  };
}

export async function getLocalTailscaleStatus(): Promise<TailscaleStatusPublic> {
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
        running: false,
        connected: false,
        backendState: null,
        hostname: null,
        dnsName: null,
        tailscaleIps: [],
        error: "Tailscale CLI is not installed.",
      };
    }

    return {
      installed: true,
      running: false,
      connected: false,
      backendState: null,
      hostname: null,
      dnsName: null,
      tailscaleIps: [],
      error: error instanceof Error ? error.message : "Unable to read Tailscale status.",
    };
  }
}

export async function installTailscale(): Promise<TailscaleInstallResult> {
  const currentStatus = await getLocalTailscaleStatus();
  if (currentStatus.installed) {
    return {
      installed: true,
      stdout: "",
      stderr: "Tailscale is already installed.",
    };
  }

  const { stdout, stderr } = await execFileAsync("sh", [
    "-c",
    "curl -fsSL https://tailscale.com/install.sh | sh",
  ], {
    timeout: 120_000,
    maxBuffer: 1024 * 1024,
  });

  return {
    installed: true,
    stdout,
    stderr,
  };
}
