import { Slider } from "@/components/ui/slider";
import type {
    AccentColorOption,
    AppearanceSettings,
    RadiusPreset,
    WallpaperOption,
} from "@/lib/desktop/appearance";
import {
    APPEARANCE_RADIUS_MAX,
    APPEARANCE_RADIUS_MIN,
    RADIUS_PRESETS,
} from "@/lib/desktop/appearance";
import {
    SectionDivider,
    SettingsSelect,
    Toggle,
} from "@/modules/settings/components/panel/controls";
import {
  SETTINGS_BADGE_SURFACE,
  SETTINGS_PANEL_INSET,
} from "@/modules/settings/components/panel/surface";
import { Check } from "@/components/icons/platform-icons";

type AppearanceSectionProps = {
  appearance: AppearanceSettings;
  wallpaperOptions: WallpaperOption[];
  accentOptions: AccentColorOption[];
  onAppearanceChange: (patch: Partial<AppearanceSettings>) => void;
};

export function AppearanceSection({
  appearance,
  wallpaperOptions,
  accentOptions,
  onAppearanceChange,
}: AppearanceSectionProps) {
  const themeOptions: {
    name: string;
    value: AppearanceSettings["theme"];
    preview: string;
  }[] = [
    { name: "Dark", value: "dark", preview: "oklch(0.13 0.015 250)" },
    { name: "Light", value: "light", preview: "oklch(0.97 0.005 250)" },
  ];
  const radiusPresets: RadiusPreset[] = RADIUS_PRESETS;

  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="Theme" />
      <div
        data-testid="theme-scroller"
        className="-mx-1 flex gap-3 overflow-x-auto px-1 py-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-glass-border"
      >
        {themeOptions.map((theme) => (
          <button
            key={theme.name}
            onClick={() => onAppearanceChange({ theme: theme.value })}
            className={`group flex min-w-[7rem] shrink-0 flex-col gap-2 rounded-[calc(var(--radius)+0.375rem)] border p-3 text-left transition-all cursor-pointer sm:min-w-[8rem] ${
              appearance.theme === theme.value
                ? "border-primary bg-primary/10 shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_28%,transparent)]"
                : "border-glass-border bg-background/46 hover:border-foreground/20 hover:bg-background/68"
            }`}
            title={theme.name}
          >
            <div
              className="h-14 w-full rounded-[calc(var(--radius)+0.125rem)] border border-glass-border/80"
              style={{ background: theme.preview }}
            />
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-xs ${
                  appearance.theme === theme.value
                    ? "text-primary font-medium"
                    : "text-muted-foreground group-hover:text-foreground"
                }`}
              >
                {theme.name}
              </span>
              {appearance.theme === theme.value ? (
                <span className="inline-flex size-5 items-center justify-center rounded-[var(--radius)] bg-primary text-primary-foreground">
                  <Check className="size-3" />
                </span>
              ) : null}
            </div>
          </button>
        ))}
      </div>

      <SectionDivider title="Accent Color" />
      <div
        data-testid="accent-scroller"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 py-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-glass-border"
      >
        {accentOptions.map((color) => (
          <button
            key={color.name}
            onClick={() => onAppearanceChange({ accentColor: color.value })}
            className={`group flex min-w-[5.5rem] shrink-0 items-center gap-2 rounded-[calc(var(--radius)+0.375rem)] border px-3 py-2 transition-all cursor-pointer sm:min-w-[6.25rem] ${
              appearance.accentColor === color.value
                ? "border-primary bg-primary/10 shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_28%,transparent)]"
                : "border-glass-border bg-background/46 hover:border-foreground/20 hover:bg-background/68"
            }`}
            title={color.name}
          >
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius)] border border-white/15 shadow-inner"
              style={{ backgroundColor: color.value }}
            >
              {appearance.accentColor === color.value ? (
                <Check className="size-3.5 text-primary-foreground" />
              ) : null}
            </span>
            <span
              className={`truncate text-xs ${
                appearance.accentColor === color.value
                  ? "font-medium text-primary"
                  : "text-muted-foreground group-hover:text-foreground"
              }`}
            >
              {color.name}
            </span>
            {appearance.accentColor === color.value ? (
              <span className="ml-auto inline-flex size-2 rounded-[var(--radius)] bg-primary" />
            ) : null}
          </button>
        ))}
      </div>

      <SectionDivider title="Shape" />
      <div className={`${SETTINGS_PANEL_INSET} p-4`}>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-sm text-foreground">Corner radius</h3>
            <p className="text-xs text-muted-foreground">
              Controls the roundness of panels and cards.
            </p>
          </div>
          <span className={`${SETTINGS_BADGE_SURFACE} inline-flex min-w-12 items-center justify-center px-2.5 py-1 text-xs font-medium text-primary`}>
            {appearance.radius}px
          </span>
        </div>
        <div className="mt-4 px-1">
          <Slider
            aria-label="Corner radius"
            min={APPEARANCE_RADIUS_MIN}
            max={APPEARANCE_RADIUS_MAX}
            step={1}
            value={[appearance.radius]}
            onValueChange={(values) => {
              const nextRadius = values[0];
              if (nextRadius === undefined) return;
              onAppearanceChange({ radius: nextRadius });
            }}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {radiusPresets.map((preset) => {
            const isActive = appearance.radius === preset.value;

            return (
              <button
                key={preset.name}
                type="button"
                aria-label={`Set ${preset.name} radius`}
                onClick={() => onAppearanceChange({ radius: preset.value })}
                className={`rounded-lg border px-3 py-2 text-left transition-colors cursor-pointer ${
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-glass-border bg-background/40 text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                }`}
              >
                <span className="block text-xs font-medium">{preset.name}</span>
                <span className="block text-2xs opacity-80">
                  {preset.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <SectionDivider title="Wallpaper" />
      <div
        data-testid="wallpaper-scroller"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 py-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-glass-border"
      >
        {wallpaperOptions.map((wallpaper) => (
          <button
            key={wallpaper.id}
            onClick={() => onAppearanceChange({ wallpaper: wallpaper.src })}
            className={`h-12 w-20 shrink-0 rounded-lg border-2 transition-all cursor-pointer overflow-hidden sm:h-14 sm:w-24 md:h-16 md:w-28 ${
              appearance.wallpaper === wallpaper.src
                ? "border-primary"
                : "border-glass-border hover:border-foreground/30"
            }`}
            title={wallpaper.name}
          >
            <div
              className="w-full h-full"
              style={{
                backgroundImage: `url('${wallpaper.src}')`,
                backgroundSize: "cover",
              }}
            />
          </button>
        ))}
      </div>

      <SectionDivider title="Display" />
      <SettingsSelect
        label="Icon size"
        value={
          appearance.iconSize === "small"
            ? "Small"
            : appearance.iconSize === "large"
              ? "Large"
              : "Medium"
        }
        options={["Small", "Medium", "Large"]}
        onChange={(value) =>
          onAppearanceChange({
            iconSize:
              value === "Small"
                ? "small"
                : value === "Large"
                  ? "large"
                  : "medium",
          })
        }
      />
      <SettingsSelect
        label="Font size"
        value={
          appearance.fontSize === "compact"
            ? "Compact"
            : appearance.fontSize === "large"
              ? "Large"
              : appearance.fontSize === "extra-large"
                ? "Extra Large"
                : "Default"
        }
        options={["Compact", "Default", "Large", "Extra Large"]}
        onChange={(value) =>
          onAppearanceChange({
            fontSize:
              value === "Compact"
                ? "compact"
                : value === "Large"
                  ? "large"
                  : value === "Extra Large"
                    ? "extra-large"
                    : "default",
          })
        }
      />
      <Toggle
        label="Animations"
        description="Enable smooth transitions and hover effects"
        enabled={appearance.animationsEnabled}
        onToggle={() =>
          onAppearanceChange({
            animationsEnabled: !appearance.animationsEnabled,
          })
        }
      />
      <SettingsSelect
        label="Dock position"
        value={
          appearance.dockPosition === "left"
            ? "Left"
            : appearance.dockPosition === "right"
              ? "Right"
              : "Bottom"
        }
        options={["Bottom", "Left", "Right"]}
        onChange={(value) =>
          onAppearanceChange({
            dockPosition:
              value.toLowerCase() as AppearanceSettings["dockPosition"],
          })
        }
      />
    </div>
  );
}
