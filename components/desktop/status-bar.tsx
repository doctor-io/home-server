"use client";

import {
  BatteryCharging,
  BatteryFull,
  Bell,
  Check,
  Cloud,
  CloudRain,
  CloudSun,
  Droplets,
  HardDrive,
  Lock,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Sun,
  Thermometer,
  Wifi,
  WifiOff,
  Wind,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// ---- WiFi dropdown ----

type WiFiNetwork = {
  name: string;
  strength: "strong" | "medium" | "weak";
  secured: boolean;
  connected?: boolean;
};

const wifiNetworks: WiFiNetwork[] = [
  { name: "ServerLab-5G", strength: "strong", secured: true, connected: true },
  { name: "ServerLab-2.4G", strength: "strong", secured: true },
  { name: "Neighbor_AP", strength: "medium", secured: true },
  { name: "Guest-Network", strength: "medium", secured: false },
  { name: "IoT-Devices", strength: "weak", secured: true },
  { name: "CoffeeShop_WiFi", strength: "weak", secured: false },
];

function WifiStrengthIcon({ strength }: { strength: string }) {
  if (strength === "strong")
    return <SignalHigh className="size-4 text-status-green" />;
  if (strength === "medium")
    return <SignalMedium className="size-4 text-status-amber" />;
  return <SignalLow className="size-4 text-status-red" />;
}

function WiFiDropdown({ onClose }: { onClose: () => void }) {
  const [wifiEnabled, setWifiEnabled] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full right-0 mt-2 w-72 bg-popover backdrop-blur-2xl border border-glass-border rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-[200]"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-glass-border">
        <div className="flex items-center gap-2">
          <Wifi className="size-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Wi-Fi</span>
        </div>
        <button
          onClick={() => setWifiEnabled(!wifiEnabled)}
          className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
            wifiEnabled ? "bg-primary" : "bg-muted"
          }`}
          aria-label="Toggle WiFi"
        >
          <span
            className={`absolute top-0.5 size-4 rounded-full bg-foreground transition-transform ${
              wifiEnabled ? "left-[18px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      {wifiEnabled ? (
        <div className="py-1 max-h-64 overflow-y-auto">
          {wifiNetworks.map((net) => (
            <button
              key={net.name}
              className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-secondary/60 transition-colors text-left cursor-pointer"
            >
              <WifiStrengthIcon strength={net.strength} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-foreground truncate">
                    {net.name}
                  </span>
                  {net.secured && (
                    <Lock className="size-3 text-muted-foreground shrink-0" />
                  )}
                </div>
                {net.connected && (
                  <span className="text-xs text-primary">Connected</span>
                )}
              </div>
              {net.connected && (
                <Check className="size-4 text-primary shrink-0" />
              )}
            </button>
          ))}
          <div className="border-t border-glass-border mt-1 pt-1 px-3 py-2">
            <button className="text-xs text-primary hover:underline cursor-pointer">
              Network Preferences...
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <WifiOff className="size-8 text-muted-foreground/50" />
          <span className="text-sm text-muted-foreground">Wi-Fi is off</span>
        </div>
      )}
    </div>
  );
}

// ---- Battery popover ----

function BatteryPopover({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full right-0 mt-2 w-64 bg-popover backdrop-blur-2xl border border-glass-border rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-[200]"
    >
      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-10 rounded-xl bg-status-green/15 flex items-center justify-center">
            <BatteryCharging className="size-5 text-status-green" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">UPS Battery</p>
            <p className="text-xs text-status-green">Charging from mains</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Charge Level</span>
              <span className="text-foreground font-medium">92%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-status-green"
                style={{ width: "92%" }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                Runtime
              </span>
              <span className="text-sm font-medium text-foreground">
                2h 14m
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                Load
              </span>
              <span className="text-sm font-medium text-foreground">340W</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                Voltage
              </span>
              <span className="text-sm font-medium text-foreground">230V</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                Model
              </span>
              <span className="text-sm font-medium text-foreground">
                APC 1500
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-glass-border px-4 py-2.5">
        <span className="text-xs text-muted-foreground">
          No battery detected refers to server itself. UPS provides backup
          power.
        </span>
      </div>
    </div>
  );
}

// ---- Weather popover ----

function WeatherPopover({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const forecast = [
    { day: "Mon", icon: Sun, temp: "24", condition: "Sunny" },
    { day: "Tue", icon: CloudSun, temp: "21", condition: "Partly Cloudy" },
    { day: "Wed", icon: Cloud, temp: "19", condition: "Overcast" },
    { day: "Thu", icon: CloudRain, temp: "16", condition: "Rain" },
    { day: "Fri", icon: Sun, temp: "23", condition: "Sunny" },
  ];

  return (
    <div
      ref={ref}
      className="absolute top-full right-0 mt-2 w-72 bg-popover backdrop-blur-2xl border border-glass-border rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-[200]"
    >
      {/* Current weather */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Server Room</p>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-light text-foreground">22</span>
              <span className="text-lg text-muted-foreground mb-0.5">°C</span>
            </div>
            <p className="text-xs text-muted-foreground">Partly Cloudy</p>
          </div>
          <CloudSun className="size-10 text-status-amber" />
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Thermometer className="size-3" /> Feels 23°
          </span>
          <span className="flex items-center gap-1">
            <Droplets className="size-3" /> 45%
          </span>
          <span className="flex items-center gap-1">
            <Wind className="size-3" /> 12 km/h
          </span>
        </div>
      </div>

      {/* 5-day forecast */}
      <div className="border-t border-glass-border px-4 py-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
          5-Day Forecast
        </p>
        <div className="flex items-center justify-between gap-1">
          {forecast.map((d) => (
            <div
              key={d.day}
              className="flex flex-col items-center gap-1 flex-1"
            >
              <span className="text-xs text-muted-foreground">{d.day}</span>
              <d.icon className="size-4 text-foreground/70" />
              <span className="text-xs font-medium text-foreground">
                {d.temp}°
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Notification popover ----

type Notification = {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
};

const notifications: Notification[] = [
  {
    id: "1",
    title: "Immich Update",
    message: "Version 1.94 is ready to install",
    time: "5 min ago",
    read: false,
  },
  {
    id: "2",
    title: "Disk Warning",
    message: "Storage pool at 85% capacity",
    time: "32 min ago",
    read: false,
  },
  {
    id: "3",
    title: "Backup Complete",
    message: "Weekly backup finished successfully",
    time: "2h ago",
    read: true,
  },
  {
    id: "4",
    title: "Pi-hole",
    message: "Blocked 14,283 queries today",
    time: "3h ago",
    read: true,
  },
];

function NotificationPopover({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full right-0 mt-2 w-80 bg-popover backdrop-blur-2xl border border-glass-border rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-[200]"
    >
      <div className="flex items-center justify-between p-3 border-b border-glass-border">
        <span className="text-sm font-semibold text-foreground">
          Notifications
        </span>
        <button className="text-xs text-primary hover:underline cursor-pointer">
          Mark all read
        </button>
      </div>
      <div className="max-h-72 overflow-y-auto">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`flex items-start gap-3 px-3 py-3 border-b border-glass-border/50 last:border-0 hover:bg-secondary/40 transition-colors ${
              !n.read ? "bg-primary/5" : ""
            }`}
          >
            {!n.read && (
              <span className="size-2 rounded-full bg-primary shrink-0 mt-1.5" />
            )}
            <div className={`flex-1 min-w-0 ${n.read ? "ml-5" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-foreground truncate">
                  {n.title}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {n.time}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {n.message}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-glass-border px-3 py-2">
        <button className="text-xs text-primary hover:underline cursor-pointer">
          View all notifications
        </button>
      </div>
    </div>
  );
}

// ---- Main Status Bar ----

export function StatusBar() {
  const [now, setNow] = useState<Date | null>(null);
  const [wifiOpen, setWifiOpen] = useState(false);
  const [batteryOpen, setBatteryOpen] = useState(false);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  function closeAll() {
    setWifiOpen(false);
    setBatteryOpen(false);
    setWeatherOpen(false);
    setNotifOpen(false);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="fixed top-3 left-1/2 -translate-x-1/2 z-50 min-w-[50%] w-auto max-w-[96vw]">
      <div className="flex items-center gap-2 px-4 py-2 bg-dock backdrop-blur-2xl border border-glass-border rounded-2xl shadow-2xl shadow-black/30">
        {/* Left - Server name */}
        <div className="flex items-center gap-2 pr-3 border-r border-glass-border/60">
          <div className="size-5 rounded-md bg-primary/20 flex items-center justify-center">
            <HardDrive className="size-3 text-primary" />
          </div>
          <span className="text-xs font-semibold text-foreground tracking-tight">
            ServerLab
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1 min-w-4" />

        {/* Right side controls */}
        <div className="flex items-center gap-1.5">
          {/* Weather */}
          <div className="relative">
            <button
              onClick={() => {
                closeAll();
                setWeatherOpen(!weatherOpen);
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-secondary/40 transition-colors cursor-pointer"
              aria-label="Weather"
            >
              <CloudSun className="size-3.5 text-status-amber" />
              <span className="text-xs text-foreground font-medium">22°</span>
            </button>
            {weatherOpen && (
              <WeatherPopover onClose={() => setWeatherOpen(false)} />
            )}
          </div>

          <div className="w-px h-3.5 bg-glass-border" />

          {/* WiFi */}
          <div className="relative">
            <button
              onClick={() => {
                closeAll();
                setWifiOpen(!wifiOpen);
              }}
              className="p-1.5 rounded-lg hover:bg-secondary/40 transition-colors cursor-pointer"
              aria-label="WiFi networks"
            >
              <Wifi className="size-4 text-status-green" />
            </button>
            {wifiOpen && <WiFiDropdown onClose={() => setWifiOpen(false)} />}
          </div>

          {/* Battery / UPS */}
          <div className="relative">
            <button
              onClick={() => {
                closeAll();
                setBatteryOpen(!batteryOpen);
              }}
              className="flex items-center gap-1 p-1.5 rounded-lg hover:bg-secondary/40 transition-colors cursor-pointer"
              aria-label="Battery status"
            >
              <BatteryFull className="size-4 text-status-green" />
              <span className="text-xs text-muted-foreground font-medium">
                92%
              </span>
            </button>
            {batteryOpen && (
              <BatteryPopover onClose={() => setBatteryOpen(false)} />
            )}
          </div>

          <div className="w-px h-4 bg-glass-border" />

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => {
                closeAll();
                setNotifOpen(!notifOpen);
              }}
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
            {notifOpen && (
              <NotificationPopover onClose={() => setNotifOpen(false)} />
            )}
          </div>

          <div className="w-px h-4 bg-glass-border" />

          {/* Clock */}
          <div className="flex items-center gap-2 pl-1">
            <div className="flex flex-col items-end">
              <span className="text-xs font-medium text-foreground leading-tight">
                {now ? formatTime(now) : "--:--"}
              </span>
              <span className="text-xs text-muted-foreground leading-tight">
                {now ? formatDate(now) : "---"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
