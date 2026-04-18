"use client";

import type { UsbDrive, UsbSseEvent } from "@/lib/shared/contracts/usb";
import { queryKeys } from "@/lib/shared/query-keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

async function fetchUsbDrives(): Promise<UsbDrive[]> {
  const res = await fetch("/api/v1/files/usb");
  if (!res.ok) return [];
  const data = await res.json() as { drives: UsbDrive[] };
  return data.drives;
}

export function useUsbDrives() {
  const queryClient = useQueryClient();

  const { data: drives = [] } = useQuery({
    queryKey: queryKeys.usbDrives,
    queryFn: fetchUsbDrives,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    const source = new EventSource("/api/v1/files/usb/stream");

    const handleEvent = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.usbDrives });
    };

    const eventTypes: UsbSseEvent["type"][] = [
      "usb.connected",
      "usb.disconnected",
      "usb.mounted",
      "usb.unmounted",
    ];
    for (const type of eventTypes) {
      source.addEventListener(type, handleEvent);
    }

    return () => {
      for (const type of eventTypes) {
        source.removeEventListener(type, handleEvent);
      }
      source.close();
    };
  }, [queryClient]);

  const mountMutation = useMutation({
    mutationFn: async (driveId: string) => {
      const res = await fetch(`/api/v1/files/usb/${driveId}/mount`, { method: "POST" });
      if (!res.ok) throw new Error("Mount failed");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.usbDrives }),
  });

  const unmountMutation = useMutation({
    mutationFn: async (driveId: string) => {
      const res = await fetch(`/api/v1/files/usb/${driveId}/unmount`, { method: "POST" });
      if (!res.ok) throw new Error("Unmount failed");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.usbDrives }),
  });

  const ejectMutation = useMutation({
    mutationFn: async (driveId: string) => {
      const res = await fetch(`/api/v1/files/usb/${driveId}/eject`, { method: "POST" });
      if (!res.ok) throw new Error("Eject failed");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.usbDrives }),
  });

  return {
    drives,
    mount: mountMutation.mutate,
    unmount: unmountMutation.mutate,
    eject: ejectMutation.mutate,
    isMounting: mountMutation.isPending,
    isUnmounting: unmountMutation.isPending,
    isEjecting: ejectMutation.isPending,
  };
}
