import "server-only";

import type { UsbSseEvent } from "@/lib/shared/contracts/usb";

type UsbSubscriber = (event: UsbSseEvent) => void;

const subscribers = new Set<UsbSubscriber>();

export function subscribeToUsbEvents(callback: UsbSubscriber): () => void {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

export function emitUsbEvent(event: UsbSseEvent) {
  for (const sub of subscribers) {
    try {
      sub(event);
    } catch {
      // ignore
    }
  }
}
