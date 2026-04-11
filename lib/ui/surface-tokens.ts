/**
 * Shared surface token strings for glass-morphism panel anatomy.
 *
 * Import these in any module instead of duplicating the string literals.
 * Module-specific aliases (FILES_PANEL_SHELL, SETTINGS_PANEL_SHELL, etc.)
 * re-export from here so existing imports remain stable.
 *
 * PANEL_SHELL   — outermost container (card / sidebar panel)
 * PANEL_INSET   — inner section within a shell (sub-card / info block)
 * BADGE_SURFACE — small pill or badge chip
 * MENU_SHELL    — floating menus, popovers, and context menus
 */
export const PANEL_SHELL =
  "rounded-[calc(var(--radius)+0.375rem)] border border-glass-border bg-card/78 shadow-sm backdrop-blur-xl";

export const PANEL_INSET =
  "rounded-[calc(var(--radius)+0.125rem)] border border-glass-border/80 bg-background/42";

export const BADGE_SURFACE =
  "rounded-[var(--radius)] border border-glass-border bg-background/55";

export const MENU_SHELL =
  "rounded-[calc(var(--radius)+0.375rem)] border border-glass-border bg-popover/96 shadow-2xl shadow-black/45 backdrop-blur-2xl";
