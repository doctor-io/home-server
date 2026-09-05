"use client";

import Image from "next/image";
import type { StoreAppSummary } from "@/lib/shared/contracts/apps";
import type { RecentCommandAction } from "@/lib/desktop/recent-actions";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  FolderOpen,
  Settings,
  ShoppingBag,
  Sparkles,
  TerminalSquare,
} from "@/components/icons/platform-icons";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useStoreCatalog } from "@/modules/apps/hooks/useStoreCatalog";

export type CommandPaletteSettingsSection = {
  id: string;
  label: string;
};

export type CommandPaletteRecentAction = RecentCommandAction;

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (query: string) => void;
  settingsSections: readonly CommandPaletteSettingsSection[];
  recentActions: readonly CommandPaletteRecentAction[];
  onOpenSettingsSection: (sectionId: string) => void;
  onOpenAppStoreSearch: (input: { search: string; appId?: string }) => void;
  onOpenWindow: (windowId: "files" | "settings" | "app-store" | "terminal") => void;
  onSelectRecentAction: (action: CommandPaletteRecentAction) => void;
};

function StoreSearchIcon({ app }: { app: StoreAppSummary }) {
  if (app.logoUrl) {
    return (
      <div className="flex size-9 items-center justify-center overflow-hidden rounded-lg border border-glass-border/80 bg-card/85 shadow-sm">
        <Image
          src={app.logoUrl}
          alt=""
          width={24}
          height={24}
          className="size-5 object-contain"
          unoptimized
        />
      </div>
    );
  }

  return (
    <div className="flex size-9 items-center justify-center rounded-lg border border-glass-border/80 bg-primary/12 text-primary shadow-sm">
      <ShoppingBag className="size-4" />
    </div>
  );
}

const ROW = "gap-2.5 rounded-lg px-2.5 py-2.5 text-sm";

/** Where a result lives, said once, inline — not a category chip on every row. */
function RowContext({ children }: { children: React.ReactNode }) {
  return (
    <span className="truncate text-muted-foreground/70 [[data-selected=true]_&]:text-accent-foreground/75">
      {children}
    </span>
  );
}

/** Only the row you are about to trigger needs to advertise the key for it. */
function EnterHint() {
  return (
    <span
      aria-hidden="true"
      className="ml-auto shrink-0 font-mono text-xs opacity-0 [[data-selected=true]_&]:text-accent-foreground/70 [[data-selected=true]_&]:opacity-100"
    >
      ↵
    </span>
  );
}

export function CommandPalette({
  open,
  onOpenChange,
  query,
  onQueryChange,
  settingsSections,
  recentActions,
  onOpenSettingsSection,
  onOpenAppStoreSearch,
  onOpenWindow,
  onSelectRecentAction,
}: CommandPaletteProps) {
  const normalizedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(normalizedQuery, 180);

  const matchingSettings = normalizedQuery
    ? settingsSections.filter((section) =>
        section.label.toLowerCase().includes(normalizedQuery.toLowerCase()),
      )
    : settingsSections.slice(0, 5);

  const storeCatalogQuery = useStoreCatalog({
    search: debouncedQuery || undefined,
  });

  const appResults = (storeCatalogQuery.data?.apps ?? [])
    .slice(0, normalizedQuery ? 7 : 5);
  const filteredRecentActions = recentActions.filter((action) => {
    if (!normalizedQuery) return true;
    const haystack = `${action.title} ${action.subtitle}`.toLowerCase();
    return haystack.includes(normalizedQuery.toLowerCase());
  });

  // A window promoted into Recent must not also appear in the static list below:
  // one ranked list should never offer the same destination twice.
  const recentWindowIds = new Set(
    filteredRecentActions
      .filter((action) => action.kind === "window")
      .map((action) => action.windowId),
  );

  function renderRecentActionIcon(action: CommandPaletteRecentAction) {
    if (action.kind === "window") {
      if (action.windowId === "files") return <FolderOpen className="size-4 text-primary" />;
      if (action.windowId === "settings") return <Settings className="size-4 text-primary" />;
      if (action.windowId === "app-store") {
        return <ShoppingBag className="size-4 text-sky-400" />;
      }
      return <TerminalSquare className="size-4 text-emerald-400" />;
    }

    if (action.kind === "settings-section") {
      return <Settings className="size-4 text-primary" />;
    }

    return <Sparkles className="size-4 text-primary" />;
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search Homeio"
      description="Jump to settings, apps, and desktop tools."
      className="overflow-hidden border border-white/[0.09] bg-black/60 p-0 shadow-[var(--system-shadow-floating)] [backdrop-filter:blur(40px)_saturate(160%)] [border-radius:var(--system-radius-floating)] max-w-[min(92vw,44rem)]"
      showCloseButton={false}
    >
      {/* One input, then results. The palette used to open on a hero icon, a
          "COMMAND PALETTE" pill and a row of keycaps — three bands of chrome
          before the first match. You reached this by typing; it does not need
          to introduce itself. */}
      <div className="border-b border-white/8 px-2">
        <CommandInput
          autoFocus
          value={query}
          onValueChange={onQueryChange}
          placeholder="Search for apps, settings, or actions"
          className="h-12 text-base text-foreground placeholder:text-muted-foreground/45"
        />
      </div>

      <CommandList className="max-h-[26rem] px-2 pb-2">
        <CommandEmpty>
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-foreground">No matches found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try a settings section, app name, or desktop tool.
            </p>
          </div>
        </CommandEmpty>

        {/* One ranked list rather than four labelled sections. When you type,
            the best match should be first, not third inside the right heading —
            and with each row naming where it lives, the headings only repeated
            what the rows already say. */}
        <CommandGroup>
          {filteredRecentActions.map((action) => (
            <CommandItem
              key={action.key}
              value={`${action.title} ${action.subtitle}`}
              onSelect={() => onSelectRecentAction(action)}
              className={ROW}
            >
              {renderRecentActionIcon(action)}
              <span className="truncate text-foreground">{action.title}</span>
              <RowContext>{action.subtitle}</RowContext>
              <EnterHint />
            </CommandItem>
          ))}

          {recentWindowIds.has("settings") ? null : (
            <CommandItem onSelect={() => onOpenWindow("settings")} className={ROW}>
              <Settings className="size-4 text-primary" />
              <span className="truncate text-foreground">Open Settings</span>
              <EnterHint />
            </CommandItem>
          )}
          {recentWindowIds.has("app-store") ? null : (
            <CommandItem onSelect={() => onOpenWindow("app-store")} className={ROW}>
              <ShoppingBag className="size-4 text-sky-400" />
              <span className="truncate text-foreground">Open App Store</span>
              <EnterHint />
            </CommandItem>
          )}
          {recentWindowIds.has("files") ? null : (
            <CommandItem onSelect={() => onOpenWindow("files")} className={ROW}>
              <FolderOpen className="size-4 text-primary" />
              <span className="truncate text-foreground">Open Files</span>
              <EnterHint />
            </CommandItem>
          )}
          {recentWindowIds.has("terminal") ? null : (
            <CommandItem onSelect={() => onOpenWindow("terminal")} className={ROW}>
              <TerminalSquare className="size-4 text-emerald-400" />
              <span className="truncate text-foreground">Open Terminal</span>
              <EnterHint />
            </CommandItem>
          )}

          {matchingSettings.map((section) => (
            <CommandItem
              key={section.id}
              onSelect={() => onOpenSettingsSection(section.id)}
              className={ROW}
            >
              <Settings className="size-4 text-primary" />
              <span className="truncate text-foreground">{section.label}</span>
              <RowContext>in Settings</RowContext>
              <EnterHint />
            </CommandItem>
          ))}

          {storeCatalogQuery.isLoading && normalizedQuery ? (
            <div className="px-2 py-3 text-xs text-muted-foreground">
              Searching apps…
            </div>
          ) : null}

          {appResults.map((app) => (
            <CommandItem
              key={app.id}
              value={`${app.name} ${app.description} ${app.categories.join(" ")}`}
              onSelect={() => onOpenAppStoreSearch({ search: app.name, appId: app.id })}
              className={ROW}
            >
              <StoreSearchIcon app={app} />
              <span className="truncate text-foreground">{app.name}</span>
              {app.updateAvailable ? (
                <span className="shrink-0 rounded-md bg-primary/12 px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Update
                </span>
              ) : null}
              <RowContext>in App Store</RowContext>
              <EnterHint />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
