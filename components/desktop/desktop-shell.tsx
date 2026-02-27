"use client";

import { useDesktopAppearance } from "@/hooks/useDesktopAppearance";
import { CurrentUserError, useCurrentUser } from "@/hooks/useCurrentUser";
import {
  readLockState,
  writeLockState,
} from "@/lib/desktop/lock-state";
import {
  Activity,
  FolderOpen,
  Package,
  Search,
  Settings,
  ShoppingBag,
  TerminalSquare,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppGrid, type AppActionTarget } from "./app-grid";
import { AppSettingsPanel } from "./apps/app-settings-panel";
import { AppStore } from "./app-store";
import {
  CustomInstallForm,
  type CustomAppInstallDialogInput,
} from "./custom-app-install-dialog";
import { useStoreActions } from "@/hooks/useStoreActions";
import { Dock } from "./dock";
import { FileManager } from "./file-manager";
import { LockScreen } from "./lock-screen";
import { Monitor } from "./monitor";
import { SettingsPanel } from "./settings";
import { StatusBar } from "./status-bar";
import { SystemWidgets } from "./system-widgets";
import { Terminal } from "./terminal";
import { Window } from "./window";

const WINDOW_CLOSE_ANIMATION_MS = 180;
const WALLPAPER_FADE_MS = 420;
const SETTINGS_SEARCH_SECTIONS = [
  { id: "general", label: "General" },
  { id: "network", label: "Network" },
  { id: "storage", label: "Storage" },
  { id: "docker", label: "Docker" },
  { id: "users", label: "Users & Access" },
  { id: "security", label: "Security" },
  { id: "notifications", label: "Notifications" },
  { id: "backup", label: "Backup & Restore" },
  { id: "updates", label: "Updates" },
  { id: "appearance", label: "Appearance" },
  { id: "power", label: "Power" },
] as const;

export function DesktopShell() {
  const router = useRouter();
  const {
    data: currentUser,
    error: currentUserError,
    isLoading: isLoadingUser,
    isError: isCurrentUserError,
  } =
    useCurrentUser();
  const [openWindows, setOpenWindows] = useState<string[]>([]);
  const [closingWindows, setClosingWindows] = useState<string[]>([]);
  const [focusedWindow, setFocusedWindow] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isLockStateHydrated, setIsLockStateHydrated] = useState(false);
  const [isLogoutPending, setIsLogoutPending] = useState(false);
  const [isSettingsSearchOpen, setIsSettingsSearchOpen] = useState(false);
  const [settingsSearchQuery, setSettingsSearchQuery] = useState("");
  const [settingsSectionRequest, setSettingsSectionRequest] = useState<string | null>(null);
  const [terminalCommandRequest, setTerminalCommandRequest] = useState<{
    id: number;
    command: string;
  } | null>(null);
  const [appSettingsTarget, setAppSettingsTarget] = useState<AppActionTarget | null>(null);
  const [customInstallError, setCustomInstallError] = useState<string | null>(null);
  const [customInstallPending, setCustomInstallPending] = useState(false);
  const terminalCommandIdRef = useRef(0);
  const [displayWallpaper, setDisplayWallpaper] = useState(
    "/images/1.jpg",
  );
  const [nextWallpaper, setNextWallpaper] = useState<string | null>(null);
  const [isWallpaperFading, setIsWallpaperFading] = useState(false);
  const closeTimersRef = useRef<Record<string, number>>({});
  const wallpaperFinalizeTimerRef = useRef<number | null>(null);
  const wallpaperFrameRef = useRef<number | null>(null);
  const wallpaperTransitionIdRef = useRef(0);
  const settingsSearchInputRef = useRef<HTMLInputElement>(null);
  const { installCustomApp } = useStoreActions();
  const {
    appearance,
    updateAppearance,
    wallpapers,
    accentColors,
    appIconSize,
  } = useDesktopAppearance();

  const setLockState = useCallback((value: boolean) => {
    setIsLocked(value);
    if (typeof window !== "undefined") {
      writeLockState(window.localStorage, value);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsLocked(readLockState(window.localStorage));
    setIsLockStateHydrated(true);
  }, []);

  useEffect(() => {
    if (isCurrentUserError) {
      if (
        currentUserError instanceof CurrentUserError &&
        currentUserError.redirectTo
      ) {
        router.replace(currentUserError.redirectTo);
        return;
      }

      router.replace("/login");
    }
  }, [currentUserError, isCurrentUserError, router]);

  const filteredSettingsSections = useMemo(() => {
    const query = settingsSearchQuery.trim().toLowerCase();
    if (!query) return SETTINGS_SEARCH_SECTIONS;
    return SETTINGS_SEARCH_SECTIONS.filter((section) =>
      section.label.toLowerCase().includes(query),
    );
  }, [settingsSearchQuery]);

  const finalizeCloseWindow = useCallback((id: string) => {
    setOpenWindows((prev) => prev.filter((w) => w !== id));
    setClosingWindows((prev) => prev.filter((w) => w !== id));
    setFocusedWindow((prev) => (prev === id ? null : prev));
  }, []);

  const openWindow = useCallback((id: string) => {
    if (closeTimersRef.current[id]) {
      window.clearTimeout(closeTimersRef.current[id]);
      delete closeTimersRef.current[id];
    }
    setClosingWindows((prev) => prev.filter((w) => w !== id));
    setOpenWindows((prev) => {
      if (prev.includes(id)) {
        // Already open, just focus it
        setFocusedWindow(id);
        return prev;
      }
      return [...prev, id];
    });
    setFocusedWindow(id);
  }, []);

  const closeWindow = useCallback(
    (id: string) => {
      if (closeTimersRef.current[id]) {
        window.clearTimeout(closeTimersRef.current[id]);
        delete closeTimersRef.current[id];
      }

      if (!appearance.animationsEnabled) {
        finalizeCloseWindow(id);
        return;
      }

      setClosingWindows((prev) => (prev.includes(id) ? prev : [...prev, id]));
      closeTimersRef.current[id] = window.setTimeout(() => {
        delete closeTimersRef.current[id];
        finalizeCloseWindow(id);
      }, WINDOW_CLOSE_ANIMATION_MS);
    },
    [appearance.animationsEnabled, finalizeCloseWindow],
  );

  useEffect(() => {
    setDisplayWallpaper(appearance.wallpaper);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (appearance.wallpaper === displayWallpaper) return;

    wallpaperTransitionIdRef.current += 1;
    const transitionId = wallpaperTransitionIdRef.current;

    if (wallpaperFinalizeTimerRef.current) {
      window.clearTimeout(wallpaperFinalizeTimerRef.current);
      wallpaperFinalizeTimerRef.current = null;
    }
    if (wallpaperFrameRef.current) {
      window.cancelAnimationFrame(wallpaperFrameRef.current);
      wallpaperFrameRef.current = null;
    }

    if (!appearance.animationsEnabled) {
      setDisplayWallpaper(appearance.wallpaper);
      setNextWallpaper(null);
      setIsWallpaperFading(false);
      return;
    }

    const targetWallpaper = appearance.wallpaper;

    const startFade = () => {
      if (transitionId !== wallpaperTransitionIdRef.current) return;
      setNextWallpaper(targetWallpaper);
      setIsWallpaperFading(false);
      wallpaperFrameRef.current = window.requestAnimationFrame(() => {
        if (transitionId !== wallpaperTransitionIdRef.current) return;
        setIsWallpaperFading(true);
        wallpaperFrameRef.current = null;
      });
      // Fallback finalize in case transitionend does not fire.
      wallpaperFinalizeTimerRef.current = window.setTimeout(() => {
        if (transitionId !== wallpaperTransitionIdRef.current) return;
        setDisplayWallpaper(targetWallpaper);
        setNextWallpaper(null);
        setIsWallpaperFading(false);
        wallpaperFinalizeTimerRef.current = null;
      }, WALLPAPER_FADE_MS + 80);
    };

    const preload = new Image();
    preload.decoding = "async";
    preload.src = targetWallpaper;
    if (preload.complete) {
      startFade();
    } else {
      preload.onload = startFade;
      preload.onerror = startFade;
    }
  }, [appearance.wallpaper, appearance.animationsEnabled, displayWallpaper]);

  useEffect(() => {
    return () => {
      Object.values(closeTimersRef.current).forEach((timer) => {
        window.clearTimeout(timer);
      });
      closeTimersRef.current = {};
      if (wallpaperFinalizeTimerRef.current) {
        window.clearTimeout(wallpaperFinalizeTimerRef.current);
      }
      if (wallpaperFrameRef.current) {
        window.cancelAnimationFrame(wallpaperFrameRef.current);
      }
    };
  }, []);

  function finalizeWallpaperFade() {
    if (!isWallpaperFading || !nextWallpaper) return;
    if (wallpaperFinalizeTimerRef.current) {
      window.clearTimeout(wallpaperFinalizeTimerRef.current);
      wallpaperFinalizeTimerRef.current = null;
    }
    setDisplayWallpaper(nextWallpaper);
    setNextWallpaper(null);
    setIsWallpaperFading(false);
  }

  function handleDockClick(id: string) {
    if (
      id !== "files" &&
      id !== "settings" &&
      id !== "app-store" &&
      id !== "terminal" &&
      id !== "monitor" &&
      id !== "app-settings"
    )
      return;

    if (openWindows.includes(id) && !closingWindows.includes(id)) {
      closeWindow(id);
    } else {
      openWindow(id);
    }
  }

  function getWindowZ(id: string) {
    return focusedWindow === id ? 110 : 100;
  }

  const requestTerminalCommand = useCallback(
    (command: string) => {
      terminalCommandIdRef.current += 1;
      setTerminalCommandRequest({
        id: terminalCommandIdRef.current,
        command,
      });
      openWindow("terminal");
    },
    [openWindow],
  );

  function openSettingsSection(sectionId: string) {
    setSettingsSectionRequest(sectionId);
    setIsSettingsSearchOpen(false);
    setSettingsSearchQuery("");
    openWindow("settings");
  }

  async function startCustomInstall(input: CustomAppInstallDialogInput) {
    setCustomInstallError(null);
    setCustomInstallPending(true);
    try {
      await installCustomApp(input);
      closeWindow("custom-install");
    } catch (error) {
      setCustomInstallError(error instanceof Error ? error.message : "Unable to install custom app.");
      throw error;
    } finally {
      setCustomInstallPending(false);
    }
  }

  useEffect(() => {
    function handleKeyboardShortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setLockState(true);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSettingsSearchOpen(true);
        setSettingsSearchQuery("");
        return;
      }
      if (e.key === "Escape" && isSettingsSearchOpen) {
        e.preventDefault();
        setIsSettingsSearchOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcut, true);
    return () => {
      window.removeEventListener("keydown", handleKeyboardShortcut, true);
    };
  }, [isSettingsSearchOpen, setLockState]);

  const handleLogout = useCallback(async () => {
    setIsLogoutPending(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      setLockState(false);
      setIsLogoutPending(false);
      router.replace("/login");
      router.refresh();
    }
  }, [router, setLockState]);

  const handleUnlock = useCallback(async (password: string) => {
    const response = await fetch("/api/auth/unlock", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      const json = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(json.error ?? "Invalid password");
    }

    setLockState(false);
  }, [setLockState]);

  useEffect(() => {
    if (!isSettingsSearchOpen) return;
    const frame = window.requestAnimationFrame(() => {
      settingsSearchInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isSettingsSearchOpen]);

  if (isLoadingUser || !isLockStateHydrated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading session...
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Wallpaper Background */}
      <div className="absolute inset-0">
        <div
          className={`absolute inset-0 bg-cover bg-center bg-no-repeat ${
            appearance.animationsEnabled
              ? "transition-opacity duration-500 ease-out"
              : ""
          } ${
            nextWallpaper && isWallpaperFading ? "opacity-0" : "opacity-100"
          }`}
          style={{
            willChange: "opacity",
            backgroundImage: `url('${displayWallpaper}')`,
          }}
        />
        {nextWallpaper && (
          <div
            className={`absolute inset-0 bg-cover bg-center bg-no-repeat ${
              appearance.animationsEnabled
                ? "transition-opacity duration-500 ease-out"
                : ""
            } ${isWallpaperFading ? "opacity-100" : "opacity-0"}`}
            style={{
              willChange: "opacity",
              backgroundImage: `url('${nextWallpaper}')`,
            }}
            onTransitionEnd={finalizeWallpaperFade}
          />
        )}
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-background/60" />
      </div>

      {/* Desktop Content */}
      <div className="relative z-10 flex h-full flex-col">
        {isSettingsSearchOpen && (
          <div
            className="fixed inset-0 z-[320] bg-background/40 backdrop-blur-sm"
            onClick={() => setIsSettingsSearchOpen(false)}
          >
            <div
              className="mx-auto mt-24 w-[min(92vw,34rem)] rounded-2xl border border-glass-border bg-popover/95 p-3 shadow-2xl shadow-black/50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-glass-border bg-card/70 px-3 py-2">
                <Search className="size-4 text-muted-foreground" />
                <input
                  ref={settingsSearchInputRef}
                  type="text"
                  value={settingsSearchQuery}
                  onChange={(e) => setSettingsSearchQuery(e.target.value)}
                  placeholder="Search in Settings..."
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
                />
                <span className="rounded bg-secondary/50 px-2 py-0.5 text-xs text-muted-foreground">
                  Esc
                </span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {filteredSettingsSections.length > 0 ? (
                  filteredSettingsSections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => openSettingsSection(section.id)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary/45 cursor-pointer"
                    >
                      <span>{section.label}</span>
                      <span className="text-xs text-muted-foreground">
                        Settings
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No settings found
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Status Bar */}
        <StatusBar
          onLock={() => setLockState(true)}
          onLogout={handleLogout}
          isLogoutPending={isLogoutPending}
        />

        {/* Main Desktop Area */}
        <div className="flex flex-1 m-12 overflow-hidden">
          {/* App Grid (scrollable center) */}
          <AppGrid
            iconSize={appIconSize}
            animationsEnabled={appearance.animationsEnabled}
            onViewLogs={({ containerName }) =>
              requestTerminalCommand(`docker logs --tail 200 ${containerName}`)
            }
            onOpenTerminal={({ containerName }) =>
              requestTerminalCommand(
                `docker exec ${containerName} /bin/sh -c "pwd && ls"`,
              )
            }
            onOpenSettings={(target) => {
              setAppSettingsTarget(target);
              openWindow("app-settings");
            }}
          />

          {/* System Widgets (right sidebar) */}
          <SystemWidgets />
        </div>

        {/* Windows */}
        {openWindows.includes("files") && (
          <Window
            title="Files"
            icon={<FolderOpen className="size-4 text-sky-400" />}
            onClose={() => closeWindow("files")}
            defaultWidth={940}
            defaultHeight={580}
            zIndex={getWindowZ("files")}
            onFocus={() => setFocusedWindow("files")}
            isClosing={closingWindows.includes("files")}
            animationsEnabled={appearance.animationsEnabled}
          >
            <FileManager />
          </Window>
        )}

        {openWindows.includes("settings") && (
          <Window
            title="Settings"
            icon={<Settings className="size-4 text-muted-foreground" />}
            onClose={() => closeWindow("settings")}
            defaultWidth={860}
            defaultHeight={620}
            zIndex={getWindowZ("settings")}
            onFocus={() => setFocusedWindow("settings")}
            isClosing={closingWindows.includes("settings")}
            animationsEnabled={appearance.animationsEnabled}
          >
            <SettingsPanel
              appearance={appearance}
              wallpaperOptions={wallpapers}
              accentOptions={accentColors}
              onAppearanceChange={updateAppearance}
              selectedSection={settingsSectionRequest}
            />
          </Window>
        )}

        {openWindows.includes("monitor") && (
          <Window
            title="Monitor"
            icon={<Activity className="size-4 text-primary" />}
            onClose={() => closeWindow("monitor")}
            defaultWidth={1120}
            defaultHeight={700}
            zIndex={getWindowZ("monitor")}
            onFocus={() => setFocusedWindow("monitor")}
            isClosing={closingWindows.includes("monitor")}
            animationsEnabled={appearance.animationsEnabled}
          >
            <Monitor />
          </Window>
        )}

        {openWindows.includes("app-store") && (
          <Window
            title="App Store"
            icon={<ShoppingBag className="size-4 text-sky-400" />}
            onClose={() => closeWindow("app-store")}
            defaultWidth={1080}
            defaultHeight={680}
            zIndex={getWindowZ("app-store")}
            onFocus={() => setFocusedWindow("app-store")}
            isClosing={closingWindows.includes("app-store")}
            animationsEnabled={appearance.animationsEnabled}
          >
            <AppStore onOpenCustomInstall={() => openWindow("custom-install")} />
          </Window>
        )}

        {openWindows.includes("custom-install") && (
          <Window
            title="Install Custom App"
            icon={<Package className="size-4 text-primary" />}
            onClose={() => {
              closeWindow("custom-install");
              setCustomInstallError(null);
            }}
            defaultWidth={720}
            defaultHeight={600}
            zIndex={getWindowZ("custom-install")}
            onFocus={() => setFocusedWindow("custom-install")}
            isClosing={closingWindows.includes("custom-install")}
            animationsEnabled={appearance.animationsEnabled}
          >
            <CustomInstallForm
              isSubmitting={customInstallPending}
              error={customInstallError}
              onCancel={() => closeWindow("custom-install")}
              onSubmit={(input) => startCustomInstall(input)}
            />
          </Window>
        )}

        {openWindows.includes("app-settings") && appSettingsTarget && (
          <Window
            title={`${appSettingsTarget.appName} Settings`}
            icon={<Settings className="size-4 text-primary" />}
            onClose={() => {
              closeWindow("app-settings");
              setAppSettingsTarget(null);
            }}
            defaultWidth={920}
            defaultHeight={700}
            zIndex={getWindowZ("app-settings")}
            onFocus={() => setFocusedWindow("app-settings")}
            isClosing={closingWindows.includes("app-settings")}
            animationsEnabled={appearance.animationsEnabled}
          >
            <AppSettingsPanel target={appSettingsTarget} />
          </Window>
        )}

        {openWindows.includes("terminal") && (
          <Window
            title="Terminal"
            icon={<TerminalSquare className="size-4 text-emerald-400" />}
            onClose={() => closeWindow("terminal")}
            defaultWidth={980}
            defaultHeight={620}
            zIndex={getWindowZ("terminal")}
            onFocus={() => setFocusedWindow("terminal")}
            isClosing={closingWindows.includes("terminal")}
            animationsEnabled={appearance.animationsEnabled}
          >
            <Terminal commandRequest={terminalCommandRequest} />
          </Window>
        )}

        {/* Dock */}
        <Dock
          activeWindows={openWindows}
          onItemClick={handleDockClick}
          position={appearance.dockPosition}
          animationsEnabled={appearance.animationsEnabled}
        />

        {isLocked && (
          <LockScreen
            wallpaper={appearance.wallpaper}
            username={currentUser?.username ?? "user"}
            onUnlock={handleUnlock}
            onLogout={handleLogout}
          />
        )}
      </div>
    </div>
  );
}
