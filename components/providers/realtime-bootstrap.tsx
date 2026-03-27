"use client";

import { useSystemSse } from "@/modules/system/hooks/useSystemSse";

export function RealtimeBootstrap() {
  useSystemSse(true);
  return null;
}
