export type DesktopTheme = "dark" | "light" | "system"
export type DesktopIconSize = "small" | "medium" | "large"
export type DesktopFontSize = "compact" | "default" | "large" | "extra-large"
export type DockPosition = "bottom" | "left" | "right"

export type WallpaperOption = {
  id: string
  name: string
  src: string
}

export type AccentColorOption = {
  name: string
  value: string
}

export type AppearanceSettings = {
  theme: DesktopTheme
  accentColor: string
  wallpaper: string
  iconSize: DesktopIconSize
  fontSize: DesktopFontSize
  animationsEnabled: boolean
  dockPosition: DockPosition
}

export const APPEARANCE_STORAGE_KEY = "desktop.appearance.v1"

export const ACCENT_COLORS: AccentColorOption[] = [
  { name: "Teal", value: "oklch(0.72 0.14 190)" },
  { name: "Blue", value: "oklch(0.65 0.2 250)" },
  { name: "Green", value: "oklch(0.72 0.18 155)" },
  { name: "Amber", value: "oklch(0.78 0.15 80)" },
  { name: "Rose", value: "oklch(0.65 0.2 10)" },
  { name: "Violet", value: "oklch(0.6 0.2 300)" },
]

export const WALLPAPER_OPTIONS: WallpaperOption[] = [
  { id: "wallpaper-default", name: "Default", src: "/images/wallpaper.jpg" },
  ...Array.from({ length: 21 }).map((_, index) => {
    const imageNumber = index + 1
    return {
      id: `wallpaper-${imageNumber}`,
      name: `Wallpaper ${imageNumber}`,
      src: `/images/${imageNumber}.jpg`,
    }
  }),
]

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  theme: "dark",
  accentColor: ACCENT_COLORS[0].value,
  wallpaper: WALLPAPER_OPTIONS[0].src,
  iconSize: "medium",
  fontSize: "default",
  animationsEnabled: true,
  dockPosition: "bottom",
}

const desktopThemes: DesktopTheme[] = ["dark", "light", "system"]
const iconSizes: DesktopIconSize[] = ["small", "medium", "large"]
const fontSizes: DesktopFontSize[] = ["compact", "default", "large", "extra-large"]
const dockPositions: DockPosition[] = ["bottom", "left", "right"]
const accentValues = new Set(ACCENT_COLORS.map((c) => c.value))
const wallpaperValues = new Set(WALLPAPER_OPTIONS.map((w) => w.src))

function isDesktopTheme(value: unknown): value is DesktopTheme {
  return typeof value === "string" && desktopThemes.includes(value as DesktopTheme)
}

function isIconSize(value: unknown): value is DesktopIconSize {
  return typeof value === "string" && iconSizes.includes(value as DesktopIconSize)
}

function isFontSize(value: unknown): value is DesktopFontSize {
  return typeof value === "string" && fontSizes.includes(value as DesktopFontSize)
}

function isDockPosition(value: unknown): value is DockPosition {
  return typeof value === "string" && dockPositions.includes(value as DockPosition)
}

export function sanitizeAppearanceSettings(input: unknown): AppearanceSettings {
  const value = (input ?? {}) as Partial<AppearanceSettings>

  return {
    theme: isDesktopTheme(value.theme) ? value.theme : DEFAULT_APPEARANCE_SETTINGS.theme,
    accentColor:
      typeof value.accentColor === "string" && accentValues.has(value.accentColor)
        ? value.accentColor
        : DEFAULT_APPEARANCE_SETTINGS.accentColor,
    wallpaper:
      typeof value.wallpaper === "string" && wallpaperValues.has(value.wallpaper)
        ? value.wallpaper
        : DEFAULT_APPEARANCE_SETTINGS.wallpaper,
    iconSize: isIconSize(value.iconSize) ? value.iconSize : DEFAULT_APPEARANCE_SETTINGS.iconSize,
    fontSize: isFontSize(value.fontSize) ? value.fontSize : DEFAULT_APPEARANCE_SETTINGS.fontSize,
    animationsEnabled:
      typeof value.animationsEnabled === "boolean"
        ? value.animationsEnabled
        : DEFAULT_APPEARANCE_SETTINGS.animationsEnabled,
    dockPosition: isDockPosition(value.dockPosition)
      ? value.dockPosition
      : DEFAULT_APPEARANCE_SETTINGS.dockPosition,
  }
}
