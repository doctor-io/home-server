"use client";

import { DEFAULT_APPEARANCE_SETTINGS } from "@/lib/desktop/appearance";
import { useAppearanceSettings } from "@/modules/shell/hooks/useAppearanceSettings";

export function useResolvedWallpaper() {
  const { data, isSuccess, isError } = useAppearanceSettings();

  return {
    wallpaper: data?.wallpaper ?? DEFAULT_APPEARANCE_SETTINGS.wallpaper,
    // Hydrated once the read settles either way — a failed read still means the
    // default is the final answer, not a value still on its way.
    isHydrated: isSuccess || isError,
  };
}
