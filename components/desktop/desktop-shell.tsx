"use client"

import { useState, useCallback } from "react"
import { Activity, FolderOpen, Settings, ShoppingBag, TerminalSquare } from "lucide-react"
import { StatusBar } from "./status-bar"
import { AppGrid } from "./app-grid"
import { Dock } from "./dock"
import { SystemWidgets } from "./system-widgets"
import { Window } from "./window"
import { FileManager } from "./file-manager"
import { SettingsPanel } from "./settings"
import { AppStore } from "./app-store"
import { Monitor } from "./monitor"
import { Terminal } from "./terminal"

export function DesktopShell() {
  const [openWindows, setOpenWindows] = useState<string[]>([])
  const [focusedWindow, setFocusedWindow] = useState<string | null>(null)

  const openWindow = useCallback((id: string) => {
    setOpenWindows((prev) => {
      if (prev.includes(id)) {
        // Already open, just focus it
        setFocusedWindow(id)
        return prev
      }
      return [...prev, id]
    })
    setFocusedWindow(id)
  }, [])

  const closeWindow = useCallback((id: string) => {
    setOpenWindows((prev) => prev.filter((w) => w !== id))
    setFocusedWindow((prev) => (prev === id ? null : prev))
  }, [])

  function handleDockClick(id: string) {
    if (id !== "files" && id !== "settings" && id !== "app-store" && id !== "terminal" && id !== "monitor") return

    if (openWindows.includes(id)) {
      closeWindow(id)
    } else {
      openWindow(id)
    }
  }

  function getWindowZ(id: string) {
    return focusedWindow === id ? 110 : 100
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Wallpaper Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/wallpaper.jpg')" }}
      >
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-background/60" />
      </div>

      {/* Desktop Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Status Bar */}
        <StatusBar />

        {/* Main Desktop Area */}
        <div className="flex flex-1 mt-12 mb-20 overflow-hidden">
          {/* App Grid (scrollable center) */}
          <AppGrid />

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
          >
            <SettingsPanel />
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
          >
            <AppStore />
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
          >
            <Terminal />
          </Window>
        )}

        {/* Dock */}
        <Dock activeWindows={openWindows} onItemClick={handleDockClick} />
      </div>
    </div>
  )
}
