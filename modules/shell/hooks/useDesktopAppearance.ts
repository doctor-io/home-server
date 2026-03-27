"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  type AppearanceSettings,
  ACCENT_COLORS,
  DEFAULT_APPEARANCE_SETTINGS,
  type DesktopFontSize,
  type DesktopIconSize,
  type DesktopTheme,
  readStoredAppearanceSettings,
  sanitizeAppearanceSettings,
  WALLPAPER_OPTIONS,
  writeStoredAppearanceSettings,
} from "@/lib/desktop/appearance"

const fontSizeScaleMap: Record<DesktopFontSize, number> = {
  compact: 14,
  default: 16,
  large: 18,
  "extra-large": 20,
}

const iconSizeMap: Record<DesktopIconSize, "small" | "medium" | "large"> = {
  small: "small",
  medium: "medium",
  large: "large",
}

function resolveTheme(theme: DesktopTheme) {
  if (theme === "system") {
    return "dark"
  }
  return theme
}

function applyAppearanceToDom(settings: AppearanceSettings) {
  const root = document.documentElement
  const resolvedTheme = resolveTheme(settings.theme)

  root.dataset.desktopTheme = resolvedTheme
  root.dataset.desktopAnimations = settings.animationsEnabled ? "on" : "off"
  root.classList.toggle("dark", resolvedTheme === "dark")
  root.style.colorScheme = resolvedTheme
  root.style.fontSize = `${fontSizeScaleMap[settings.fontSize]}px`
  root.style.setProperty("--radius", `${settings.radius}px`)
  root.style.setProperty("--primary", settings.accentColor)
  root.style.setProperty("--accent", settings.accentColor)
  root.style.setProperty("--ring", settings.accentColor)
  root.style.setProperty("--sidebar-primary", settings.accentColor)
  root.style.setProperty("--chart-1", settings.accentColor)
}

export function useDesktopAppearance() {
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setAppearance(readStoredAppearanceSettings(window.localStorage))
    setLoaded(true)
  }, [])

  useEffect(() => {
    applyAppearanceToDom(appearance)
  }, [appearance])

  useEffect(() => {
    if (!loaded) return
    writeStoredAppearanceSettings(window.localStorage, appearance)
  }, [appearance, loaded])

  useEffect(() => {
    if (appearance.theme !== "system") return
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const handleThemeChange = () => {
      applyAppearanceToDom(appearance)
    }
    media.addEventListener("change", handleThemeChange)
    return () => media.removeEventListener("change", handleThemeChange)
  }, [appearance])

  const updateAppearance = useCallback((patch: Partial<AppearanceSettings>) => {
    setAppearance((prev) => sanitizeAppearanceSettings({ ...prev, ...patch }))
  }, [])

  const appIconSize = useMemo(() => iconSizeMap[appearance.iconSize], [appearance.iconSize])

  return {
    appearance,
    updateAppearance,
    wallpapers: WALLPAPER_OPTIONS,
    accentColors: ACCENT_COLORS,
    appIconSize,
  }
}
