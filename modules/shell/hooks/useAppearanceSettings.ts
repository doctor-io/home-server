"use client";

import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_APPEARANCE_SETTINGS,
  sanitizeAppearanceSettings,
  type AppearanceSettings,
} from "@/lib/desktop/appearance";
import { queryKeys } from "@/lib/shared/query-keys";

async function fetchAppearanceSettings(): Promise<AppearanceSettings> {
  const res = await fetch("/api/v1/settings/appearance", { cache: "no-store" });
  if (!res.ok) return DEFAULT_APPEARANCE_SETTINGS;
  const json = (await res.json()) as { data: AppearanceSettings };
  return sanitizeAppearanceSettings(json.data);
}

/**
 * One shared read of the appearance settings.
 *
 * The wallpaper hook and the desktop appearance hook each used to fetch this
 * endpoint on mount with a raw `fetch`, so a single desktop load asked for the
 * same document three times. Going through the query cache collapses that to
 * one request whoever mounts first.
 */
export function useAppearanceSettings() {
  return useQuery({
    queryKey: queryKeys.appearanceSettings,
    queryFn: fetchAppearanceSettings,
    staleTime: 60_000,
  });
}
