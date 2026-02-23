"use client";

import { BatteryFull, Bell, CloudSun, HardDrive, Lock, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { BatteryPopover } from "@/components/desktop/status-bar/battery-popover";
import { DatePickerPopover } from "@/components/desktop/status-bar/date-picker-popover";
import { NotificationPopover } from "@/components/desktop/status-bar/notification-popover";
import { useStatusBarData } from "@/components/desktop/status-bar/use-status-bar-data";
import { WeatherPopover } from "@/components/desktop/status-bar/weather-popover";
import { WifiPopover } from "@/components/desktop/status-bar/wifi-popover";
import { useCurrentWeather } from "@/hooks/useCurrentWeather";
import type { StatusBarProps, StatusPopover } from "@/components/desktop/status-bar/types";
import { formatDate, formatTemperature, formatTime } from "@/components/desktop/status-bar/utils";

export function StatusBar({
  onLock,
  onLogout,
  isLogoutPending = false,
}: StatusBarProps) {
  const {
    metrics,
    serverName,
    batteryText,
    isWifiConnected,
    isMetricsError,
    wifiIconClassName,
    notifications,
    unreadCount,
    markAllRead,
    clearNotifications,
  } = useStatusBarData();
  const { data: weather } = useCurrentWeather();
  const weatherText = formatTemperature(weather?.current.temperatureC);

  const [now, setNow] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activePopover, setActivePopover] = useState<StatusPopover | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  function closePopovers() {
    setActivePopover(null);
  }

  function togglePopover(popover: StatusPopover) {
    setActivePopover((current) => (current === popover ? null : popover));
  }

  return (
    <header className="fixed top-3 left-1/2 -translate-x-1/2 z-50 min-w-[50%] w-auto max-w-[96vw]">
      <div className="flex items-center gap-2 px-4 py-2 bg-dock backdrop-blur-2xl border border-glass-border rounded-2xl shadow-2xl shadow-black/30">
        <div className="flex items-center gap-2 pr-3 border-r border-glass-border/60">
          <div className="size-5 rounded-md bg-primary/20 flex items-center justify-center">
            <HardDrive className="size-3 text-primary" />
          </div>
          <span className="text-xs font-semibold text-foreground tracking-tight">
            {serverName}
          </span>
        </div>

        <div className="flex-1 min-w-4" />

        <div className="flex items-center gap-1.5">
          <div className="relative">
            <button
              onClick={() => togglePopover("weather")}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-secondary/40 transition-colors cursor-pointer"
              aria-label="Weather"
            >
              <CloudSun className="size-3.5 text-status-amber" />
              <span className="text-xs text-foreground font-medium">{weatherText}</span>
            </button>
            {activePopover === "weather" && (
              <WeatherPopover weather={weather} onClose={closePopovers} />
            )}
          </div>

          <div className="w-px h-3.5 bg-glass-border" />

          <div className="relative">
            <button
              onClick={() => togglePopover("wifi")}
              className="p-1.5 rounded-lg hover:bg-secondary/40 transition-colors cursor-pointer"
              aria-label="WiFi networks"
            >
              {isMetricsError || !isWifiConnected ? (
                <WifiOff className={wifiIconClassName} />
              ) : (
                <Wifi className={wifiIconClassName} />
              )}
            </button>
            {activePopover === "wifi" && (
              <WifiPopover metrics={metrics} onClose={closePopovers} />
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => togglePopover("battery")}
              className="flex items-center gap-1 p-1.5 rounded-lg hover:bg-secondary/40 transition-colors cursor-pointer"
              aria-label="Battery status"
            >
              <BatteryFull className="size-4 text-status-green" />
              <span className="text-xs text-muted-foreground font-medium">
                {batteryText}
              </span>
            </button>
            {activePopover === "battery" && (
              <BatteryPopover battery={metrics?.battery} onClose={closePopovers} />
            )}
          </div>

          <div className="w-px h-4 bg-glass-border" />

          <div className="relative">
            <button
              onClick={() => togglePopover("notifications")}
              className="relative p-1.5 rounded-lg hover:bg-secondary/40 transition-colors cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="size-4 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-primary text-xs text-primary-foreground flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
            {activePopover === "notifications" && (
              <NotificationPopover
                notifications={notifications}
                onMarkAllRead={markAllRead}
                onClearAll={clearNotifications}
                onClose={closePopovers}
              />
            )}
          </div>

          <div className="w-px h-4 bg-glass-border" />

          {onLock ? (
            <button
              onClick={onLock}
              className="p-1.5 rounded-lg hover:bg-secondary/40 transition-colors cursor-pointer"
              aria-label="Lock screen"
              title="Lock screen"
            >
              <Lock className="size-4 text-muted-foreground" />
            </button>
          ) : null}

          {onLogout ? (
            <LogoutButton onLogout={onLogout} isPending={isLogoutPending} />
          ) : null}

          {onLock || onLogout ? <div className="w-px h-4 bg-glass-border" /> : null}

          <div className="relative flex items-center gap-2 pl-1">
            <div className="flex flex-col items-end">
              <span className="text-xs font-medium text-foreground leading-tight">
                {now ? formatTime(now) : "--:--"}
              </span>
              <button
                onClick={() => togglePopover("date")}
                className="text-xs text-muted-foreground leading-tight hover:text-foreground transition-colors cursor-pointer"
                aria-label="Open date picker"
              >
                {now ? formatDate(now) : "---"}
              </button>
            </div>
            {activePopover === "date" && (
              <DatePickerPopover
                onClose={closePopovers}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
