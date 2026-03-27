"use client";

import {
  BatteryFull,
  Bell,
  CloudSun
} from "@/components/icons/platform-icons";
import { BatteryPopover } from "@/modules/system/components/status-bar/battery-popover";
import { DatePickerPopover } from "@/modules/system/components/status-bar/date-picker-popover";
import { NotificationPopover } from "@/modules/system/components/status-bar/notification-popover";
import type {
  StatusBarProps,
  StatusPopover,
} from "@/modules/system/components/status-bar/types";
import { useStatusBarData } from "@/modules/system/components/status-bar/use-status-bar-data";
import {
  formatDate,
  formatTemperature,
  formatTime,
} from "@/modules/system/components/status-bar/utils";
import { WeatherPopover } from "@/modules/system/components/status-bar/weather-popover";
import { WifiStatusIcon } from "@/modules/system/components/status-bar/wifi-icons";
import { WifiPopover } from "@/modules/system/components/status-bar/wifi-popover";
import { useCurrentWeather } from "@/modules/system/hooks/useCurrentWeather";
import { useNetworkEventsSse } from "@/modules/system/hooks/useNetworkEventsSse";
import Image from "next/image";
import { useEffect, useState } from "react";

function toTitleCaseUsername(value: string | null) {
  if (!value) return "User";

  return value
    .trim()
    .split(/[\s_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function StatusBar({
  onLock: _onLock,
  onLogout: _onLogout,
  isLogoutPending: _isLogoutPending = false,
}: StatusBarProps) {
  const {
    metrics,
    networkStatus,
    username,
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
  useNetworkEventsSse(true);
  const weatherText = formatTemperature(weather?.current.temperatureC);

  const [now, setNow] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activePopover, setActivePopover] = useState<StatusPopover | null>(
    null,
  );

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
          <div className="flex size-6 items-center justify-center overflow-hidden rounded-md border border-primary/20 bg-white/80 shadow-sm shadow-black/10">
            <Image
              src="/icon.png"
              alt="Homeio"
              width={24}
              height={24}
              className="size-5"
            />
          </div>
          <span className="text-xs font-semibold tracking-tight text-foreground">
            <span className="xl:hidden">{`Hi, ${toTitleCaseUsername(username)}`}</span>
            <span className="hidden xl:inline">{`Welcome back, ${toTitleCaseUsername(username)}`}</span>
          </span>
          <span
            className="text-sm leading-none text-status-amber"
            role="img"
            aria-label="waving hand"
          >
            👋
          </span>
        </div>

        <div className="flex-1 min-w-4" />

        <div className="flex items-center">
          <div className="relative">
            <button
              onClick={() => togglePopover("weather")}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-secondary/40 transition-colors cursor-pointer"
              aria-label="Weather"
            >
              <CloudSun className="size-3.5 text-status-amber" />
              <span className="text-xs text-foreground font-medium">
                {weatherText}
              </span>
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
              <WifiStatusIcon
                connected={!isMetricsError && isWifiConnected}
                quality={
                  networkStatus?.signalPercent ??
                  metrics?.wifi.signalPercent ??
                  null
                }
                className={wifiIconClassName}
              />
            </button>
            {activePopover === "wifi" && (
              <WifiPopover
                metrics={metrics}
                networkStatus={networkStatus}
                onClose={closePopovers}
              />
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
              <BatteryPopover
                battery={metrics?.battery}
                onClose={closePopovers}
              />
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
                <span className="absolute -top-0.5 -right-0.5 size-4 rounded-[var(--radius)] bg-primary text-xs text-primary-foreground flex items-center justify-center font-bold">
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

          {/* {onLock ? (
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

          {onLock || onLogout ? (
            <div className="w-px h-4 bg-glass-border" />
          ) : null} */}

          <div className="relative flex items-center gap-2 pl-1">
            <button
              onClick={() => togglePopover("date")}
              className="flex flex-row items-end rounded-lg px-1.5 gap-2 py-1 text-right transition-colors hover:bg-secondary/40 cursor-pointer"
              aria-label="Open date picker"
            >
              <span className="hidden xl:text-xs xl:leading-tight xl:text-muted-foreground xl:block">
                {now ? formatDate(now) : "---"}
              </span>
              <span className="text-xs font-medium text-foreground leading-tight">
                {now ? formatTime(now) : "--:--"}
              </span>
            </button>
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
