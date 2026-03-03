import "server-only";

import { logServerAction } from "@/lib/server/logging/logger";
import {
  subscribeToHelperEvents,
  type NetworkHelperError,
} from "@/lib/server/modules/network/helper-client";
import type { NetworkEvent } from "@/lib/shared/contracts/network";

type Subscriber = (event: NetworkEvent) => void;

const subscribers = new Set<Subscriber>();
let latestNetworkEvent: NetworkEvent | null = null;
let unsubscribeHelper: (() => void) | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let bridgeStarted = false;

function emit(event: NetworkEvent) {
  latestNetworkEvent = event;
  for (const subscriber of subscribers) {
    subscriber(event);
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectHelperStream();
  }, 2_000);
}

function connectHelperStream() {
  if (!bridgeStarted) return;
  if (unsubscribeHelper) return;

  unsubscribeHelper = subscribeToHelperEvents(
    (event) => {
      emit(event);
    },
    {
      onError: (error) => {
        unsubscribeHelper = null;

        const helperError = error as NetworkHelperError | Error;
        logServerAction({
          level: "warn",
          layer: "service",
          action: "network.events.bridge",
          status: "error",
          message: "DBus helper event stream disconnected; retrying",
          error: helperError,
        });

        if (subscribers.size > 0) {
          scheduleReconnect();
        }
      },
    },
  );
}

function ensureBridgeStarted() {
  if (bridgeStarted) return;
  bridgeStarted = true;
  connectHelperStream();
}

function stopBridge() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (unsubscribeHelper) {
    unsubscribeHelper();
    unsubscribeHelper = null;
  }

  bridgeStarted = false;
}

export function getLatestNetworkEvent() {
  return latestNetworkEvent;
}

export function subscribeToNetworkEvents(subscriber: Subscriber) {
  subscribers.add(subscriber);
  ensureBridgeStarted();

  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0) {
      stopBridge();
    }
  };
}
