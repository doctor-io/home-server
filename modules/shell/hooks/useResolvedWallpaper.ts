"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_APPEARANCE_SETTINGS,
  sanitizeAppearanceSettings,
  type AppearanceSettings,
} from "@/lib/desktop/appearance";

export function useResolvedWallpaper() {
  const [wallpaper, setWallpaper] = useState(DEFAULT_APPEARANCE_SETTINGS.wallpaper);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    fetch("/api/v1/settings/appearance", { cache: "no-store" })
      .then((res) => res.ok ? res.json() : null)
      .then((json: { data: AppearanceSettings } | null) => {
        if (json?.data) {
          setWallpaper(sanitizeAppearanceSettings(json.data).wallpaper);
        }
        setIsHydrated(true);
      })
      .catch(() => setIsHydrated(true));
  }, []);

  return { wallpaper, isHydrated };
}
