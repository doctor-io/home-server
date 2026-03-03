"use client";

import { useSystemSse } from "@/hooks/useSystemSse";

export function RealtimeBootstrap() {
  useSystemSse(true);
  return null;
}
