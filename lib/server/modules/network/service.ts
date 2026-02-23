import "server-only";

import { z } from "zod";
import {
  connectWifiFromHelper,
  disconnectWifiFromHelper,
  getNetworkStatusFromHelper,
  isNetworkHelperUnavailableError,
  type NetworkHelperError,
  scanWifiNetworksFromHelper,
} from "@/lib/server/modules/network/helper-client";
import { logServerAction, withServerTiming } from "@/lib/server/logging/logger";
import { getSystemMetricsSnapshot } from "@/lib/server/modules/system/service";
import type {
  ConnectNetworkRequest,
  DisconnectNetworkRequest,
  NetworkServiceErrorCode,
  NetworkStatus,
  WifiAccessPoint,
} from "@/lib/shared/contracts/network";

type RequestContext = {
  requestId?: string;
};

type NetworkSource = "helper" | "fallback";

type NetworkStatusResult = {
  data: NetworkStatus;
  source: NetworkSource;
};

type WifiNetworksResult = {
  data: WifiAccessPoint[];
  source: NetworkSource;
};

const connectNetworkSchema = z.object({
  ssid: z.string().trim().min(1).max(128),
  password: z.string().min(1).max(128).optional(),
});

const disconnectNetworkSchema = z.object({
  iface: z.string().trim().min(1).max(64).optional(),
});

export class NetworkServiceError extends Error {
  readonly code: NetworkServiceErrorCode;
  readonly statusCode: number;

  constructor(
    message: string,
    options?: {
      code?: NetworkServiceErrorCode;
      statusCode?: number;
      cause?: unknown;
    },
  ) {
    super(message, {
      cause: options?.cause,
    });

    this.name = "NetworkServiceError";
    this.code = options?.code ?? "internal_error";
    this.statusCode = options?.statusCode ?? 500;
  }
}

function mapFallbackStatusFromMetrics(snapshot: Awaited<ReturnType<typeof getSystemMetricsSnapshot>>) {
  return {
    connected: snapshot.wifi.connected,
    iface: snapshot.wifi.iface,
    ssid: snapshot.wifi.ssid,
    ipv4: snapshot.wifi.ipv4,
    signalPercent: snapshot.wifi.signalPercent,
  } satisfies NetworkStatus;
}

function mapFallbackNetworksFromMetrics(snapshot: Awaited<ReturnType<typeof getSystemMetricsSnapshot>>) {
  return snapshot.wifi.availableNetworks
    .map((network) => ({
      ssid: network.ssid,
      bssid: null,
      signalPercent: network.qualityPercent,
      channel: network.channel,
      frequencyMhz: null,
      security: network.security,
    }))
    .sort((left, right) => (right.signalPercent ?? 0) - (left.signalPercent ?? 0));
}

function mapKnownServiceError(error: unknown) {
  if (error instanceof NetworkServiceError) return error;

  if (error instanceof Error && error.name === "NetworkHelperError") {
    const helperError = error as NetworkHelperError;
    return new NetworkServiceError(helperError.message, {
      code: helperError.code,
      statusCode: helperError.statusCode,
      cause: error,
    });
  }

  return new NetworkServiceError("Network request failed", {
    code: "internal_error",
    statusCode: 500,
    cause: error,
  });
}

function validateConnectInput(input: unknown) {
  const parsed = connectNetworkSchema.safeParse(input);
  if (!parsed.success) {
    throw new NetworkServiceError("Invalid network connect payload", {
      code: "invalid_request",
      statusCode: 400,
      cause: parsed.error,
    });
  }

  return parsed.data satisfies ConnectNetworkRequest;
}

function validateDisconnectInput(input: unknown) {
  const parsed = disconnectNetworkSchema.safeParse(input ?? {});
  if (!parsed.success) {
    throw new NetworkServiceError("Invalid network disconnect payload", {
      code: "invalid_request",
      statusCode: 400,
      cause: parsed.error,
    });
  }

  return parsed.data satisfies DisconnectNetworkRequest;
}

export async function getNetworkStatus(context?: RequestContext): Promise<NetworkStatusResult> {
  return withServerTiming(
    {
      layer: "service",
      action: "network.status.get",
      requestId: context?.requestId,
    },
    async () => {
      try {
        const data = await getNetworkStatusFromHelper({
          requestId: context?.requestId,
        });

        return {
          data,
          source: "helper",
        } satisfies NetworkStatusResult;
      } catch (error) {
        if (!isNetworkHelperUnavailableError(error)) {
          throw mapKnownServiceError(error);
        }

        logServerAction({
          level: "warn",
          layer: "service",
          action: "network.status.get.fallback",
          status: "error",
          requestId: context?.requestId,
          message:
            "DBus helper unavailable; using cached system metrics fallback for network status",
          error,
        });

        const snapshot = await getSystemMetricsSnapshot();

        return {
          data: mapFallbackStatusFromMetrics(snapshot),
          source: "fallback",
        } satisfies NetworkStatusResult;
      }
    },
  );
}

export async function getWifiNetworks(
  context?: RequestContext,
): Promise<WifiNetworksResult> {
  return withServerTiming(
    {
      layer: "service",
      action: "network.networks.get",
      requestId: context?.requestId,
    },
    async () => {
      try {
        const data = await scanWifiNetworksFromHelper({
          requestId: context?.requestId,
        });

        return {
          data,
          source: "helper",
        } satisfies WifiNetworksResult;
      } catch (error) {
        if (!isNetworkHelperUnavailableError(error)) {
          throw mapKnownServiceError(error);
        }

        logServerAction({
          level: "warn",
          layer: "service",
          action: "network.networks.get.fallback",
          status: "error",
          requestId: context?.requestId,
          message:
            "DBus helper unavailable; using cached system metrics fallback for Wi-Fi list",
          error,
        });

        const snapshot = await getSystemMetricsSnapshot();

        return {
          data: mapFallbackNetworksFromMetrics(snapshot),
          source: "fallback",
        } satisfies WifiNetworksResult;
      }
    },
  );
}

export async function connectNetwork(
  input: unknown,
  context?: RequestContext,
): Promise<NetworkStatus> {
  const validated = validateConnectInput(input);

  return withServerTiming(
    {
      layer: "service",
      action: "network.connect.post",
      requestId: context?.requestId,
      meta: {
        ssid: validated.ssid,
      },
    },
    async () => {
      try {
        return await connectWifiFromHelper(validated, {
          requestId: context?.requestId,
        });
      } catch (error) {
        throw mapKnownServiceError(error);
      }
    },
  );
}

export async function disconnectNetwork(
  input: unknown,
  context?: RequestContext,
): Promise<NetworkStatus> {
  const validated = validateDisconnectInput(input);

  return withServerTiming(
    {
      layer: "service",
      action: "network.disconnect.post",
      requestId: context?.requestId,
      meta: {
        iface: validated.iface ?? null,
      },
    },
    async () => {
      try {
        return await disconnectWifiFromHelper(validated, {
          requestId: context?.requestId,
        });
      } catch (error) {
        throw mapKnownServiceError(error);
      }
    },
  );
}
