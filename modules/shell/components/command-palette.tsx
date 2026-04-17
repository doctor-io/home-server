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
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Clock,
  FolderOpen,
  Search,
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
      className="system-floating-surface max-w-[min(92vw,48rem)] bg-popover/96 p-0 shadow-[var(--system-shadow-floating)]"
      showCloseButton={false}
    >
      <div className="border-b border-glass-border/80 bg-card/55 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-[var(--system-radius-icon)] border border-primary/20 bg-primary/12 text-primary">
              <Search className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Search Homeio</p>
              <p className="text-xs text-muted-foreground">
                Settings, apps, and desktop actions in one place.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            <span className="rounded-md border border-glass-border bg-background/70 px-2 py-1 font-medium tracking-wide">
              Cmd K
            </span>
            <span className="rounded-md border border-glass-border bg-background/70 px-2 py-1 font-medium tracking-wide">
              Esc
            </span>
          </div>
        </div>
      </div>

      <CommandInput
        autoFocus
        value={query}
        onValueChange={onQueryChange}
        placeholder="Search settings, apps, and tools..."
        className="text-sm"
      />

      <CommandList className="max-h-[26rem]">
        <CommandEmpty>
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-foreground">No matches found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try a settings section, app name, or desktop tool.
            </p>
          </div>
        </CommandEmpty>

        {filteredRecentActions.length > 0 ? (
          <>
            <CommandGroup heading="Recent">
              {filteredRecentActions.map((action) => (
                <CommandItem
                  key={action.key}
                  value={`${action.title} ${action.subtitle}`}
                  onSelect={() => onSelectRecentAction(action)}
                >
                  {renderRecentActionIcon(action)}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {action.title}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {action.subtitle}
                    </div>
                  </div>
                  <CommandShortcut className="flex items-center gap-1 tracking-normal">
                    <Clock className="size-3.5" />
                    <span>Recent</span>
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />
          </>
        ) : null}

        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => onOpenWindow("settings")}>
            <Settings className="size-4 text-primary" />
            <span>Open Settings</span>
            <CommandShortcut>System</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => onOpenWindow("app-store")}>
            <ShoppingBag className="size-4 text-sky-400" />
            <span>Open App Store</span>
            <CommandShortcut>Apps</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => onOpenWindow("files")}>
            <FolderOpen className="size-4 text-primary" />
            <span>Open Files</span>
            <CommandShortcut>/DATA</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => onOpenWindow("terminal")}>
            <TerminalSquare className="size-4 text-emerald-400" />
            <span>Open Terminal</span>
            <CommandShortcut>Shell</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Settings">
          {matchingSettings.map((section) => (
            <CommandItem
              key={section.id}
              onSelect={() => onOpenSettingsSection(section.id)}
            >
              <Settings className="size-4 text-primary" />
              <span>{section.label}</span>
              <CommandShortcut>Settings</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="App Store">
          {storeCatalogQuery.isLoading && normalizedQuery ? (
            <div className="px-2 py-3 text-xs text-muted-foreground">
              Searching apps...
            </div>
          ) : null}

          {!storeCatalogQuery.isLoading && appResults.length === 0 && normalizedQuery ? (
            <div className="px-2 py-3 text-xs text-muted-foreground">
              No App Store apps match “{normalizedQuery}”.
            </div>
          ) : null}

          {appResults.map((app) => (
            <CommandItem
              key={app.id}
              value={`${app.name} ${app.description} ${app.categories.join(" ")}`}
              onSelect={() =>
                onOpenAppStoreSearch({
                  search: app.name,
                  appId: app.id,
                })
              }
              className="gap-3 rounded-lg py-2.5"
            >
              <StoreSearchIcon app={app} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {app.name}
                  </span>
                  {app.updateAvailable ? (
                    <span className="rounded-md bg-primary/12 px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-[0.16em] text-primary">
                      Update
                    </span>
                  ) : null}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {app.description}
                </p>
              </div>
              <CommandShortcut className="flex items-center gap-1 tracking-normal">
                <Sparkles className="size-3.5" />
                <span>App Store</span>
              </CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
