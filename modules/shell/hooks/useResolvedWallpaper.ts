"use client";

import { useEffect, useState } from "react";
import {
  APPEARANCE_CHANGED_EVENT,
  APPEARANCE_STORAGE_KEY,
  DEFAULT_APPEARANCE_SETTINGS,
  readStoredAppearanceSettings,
} from "@/lib/desktop/appearance";

function readWallpaperFromStorage() {
  if (typeof window === "undefined") {
    return DEFAULT_APPEARANCE_SETTINGS.wallpaper;
  }

  return readStoredAppearanceSettings(window.localStorage).wallpaper;
}

export function useResolvedWallpaper() {
  const [wallpaper, setWallpaper] = useState(
    DEFAULT_APPEARANCE_SETTINGS.wallpaper,
  );
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const syncWallpaper = () => {
      setWallpaper(readWallpaperFromStorage());
      setIsHydrated(true);
    };

    syncWallpaper();

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== APPEARANCE_STORAGE_KEY) return;
      syncWallpaper();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(APPEARANCE_CHANGED_EVENT, syncWallpaper);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(APPEARANCE_CHANGED_EVENT, syncWallpaper);
    };
  }, []);

  return {
    wallpaper,
    isHydrated,
  };
}
