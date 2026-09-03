"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight, LayoutGrid, LockKeyhole, LogOut, Server } from "@/components/icons/platform-icons";
import type { PushConfigPublic } from "@/lib/shared/contracts/push";
import { cn } from "@/lib/utils";
import { pushRowState } from "@/modules/phone/push-subscription";

/**
 * The launcher stamps this on the WebView's user agent (capacitor.config.ts).
 * It is the only signal available here: Homeio is served from the server's
 * origin, and Capacitor's bridge is injected into the app's own origin only, so
 * `window.Capacitor` never exists on this page.
 */
const APP_USER_AGENT_MARKER = "HomeioApp";

/** Where the launcher lives inside the app, and the flag that stops it bouncing back. */
const LAUNCHER_URL = "http://localhost/?disconnect=1";

/**
 * The narrow native interface MainActivity injects into every page the WebView
 * loads. It is the only way this page can reach settings that belong to the
 * app rather than to the server — and turning the lock off asks for a
 * fingerprint on the native side, so a page that is not the owner cannot
 * quietly weaken it.
 */
type AppSettingsBridge = {
  read: () => string;
  setLock: (enabled: boolean) => void;
  setAutoReconnect: (enabled: boolean) => void;
  /** Both added in 2.0; an older launcher has neither. */
  setPush?: (url: string, topic: string) => void;
  clearPush?: () => void;
};

type AppSettings = {
  lock: boolean;
  autoReconnect: boolean;
  /** What this phone is listening to, null when it is listening to nothing. */
  pushTopic?: string | null;
};

function bridge(): AppSettingsBridge | null {
  return (window as unknown as { HomeioApp?: AppSettingsBridge }).HomeioApp ?? null;
}

function readSettings(): AppSettings | null {
  const api = bridge();
  if (!api) return null;

  try {
    return JSON.parse(api.read()) as AppSettings;
  } catch {
    return null;
  }
}

function Switch({
  label,
  hint,
  checked,
  disabled,
  icon: Icon = LockKeyhole,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  icon?: typeof Server;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex min-h-14 w-full items-center gap-3.5 px-3.5 py-3 text-left active:bg-white/6",
        disabled && "opacity-55",
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/5">
        <Icon className="size-5 grayscale" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px]">{label}</span>
        <span className="block text-[11px] text-muted-foreground">{hint}</span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "flex h-6 w-10 shrink-0 items-center rounded-full p-[3px] transition-colors",
          checked ? "bg-primary" : "bg-white/15",
        )}
      >
        <span
          className={cn(
            "size-[1.125rem] rounded-full bg-white transition-transform",
            checked && "translate-x-4",
          )}
        />
      </span>
    </button>
  );
}

function Row({
  icon: Icon,
  label,
  hint,
  href,
  onClick,
  tone,
}: {
  icon: typeof Server;
  label: string;
  hint?: string;
  href?: string;
  onClick?: () => void;
  tone?: "danger";
}) {
  const content = (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/5">
        <Icon className="size-5 grayscale" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={tone === "danger" ? "block text-[13.5px] text-status-red" : "block text-[13.5px]"}>
          {label}
        </span>
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
      <ChevronRight className="size-4 shrink-0 opacity-35" />
    </>
  );

  const className =
    "flex min-h-14 w-full items-center gap-3.5 px-3.5 py-3 text-left active:bg-white/6";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

export function PhoneSettings() {
  const [inApp, setInApp] = useState(false);
  const [origin, setOrigin] = useState("");
  const [app, setApp] = useState<AppSettings | null>(null);
  const [push, setPush] = useState<PushConfigPublic | null>(null);

  useEffect(() => {
    setInApp(navigator.userAgent.includes(APP_USER_AGENT_MARKER));
    setOrigin(window.location.host);
    setApp(readSettings());

    // The native side fires this after every change it applies — including the
    // one it refused, so a switch the owner declined to move goes back.
    const sync = () => setApp(readSettings());
    window.addEventListener("homeio:app-settings", sync);
    return () => window.removeEventListener("homeio:app-settings", sync);
  }, []);

  useEffect(() => {
    // Only worth asking inside a launcher that can act on the answer. In a
    // browser tab there is nothing to subscribe, and on a server old enough not
    // to have the route the request simply fails and the row stays away.
    if (!bridge()?.setPush) return;

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/v1/settings/push");
        if (!response.ok) return;
        const json = (await response.json()) as { data: PushConfigPublic };
        if (!cancelled) setPush(json.data);
      } catch {
        // Same as a 404: no row rather than a wrong one.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const pushState = pushRowState(push, app?.pushTopic ?? null);

  return (
    <div className="flex flex-col gap-3.5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">Connected to</p>
          <h1 className="truncate text-lg font-medium">{origin || "this server"}</h1>
        </div>
        <Server className="mt-1 size-5 opacity-40 grayscale" />
      </header>

      <section className="overflow-hidden rounded-3xl bg-white/4">
        <div className="border-b border-white/5 last:border-b-0">
          <Row
            icon={LayoutGrid}
            label="Desktop view"
            hint="The full shell, windows and all"
            href="/"
          />
        </div>

        {/* Settings that belong to the phone, not the server, reached through
            the native bridge because this page cannot touch app storage. */}
        {app && (
          <>
            <div className="border-b border-white/5">
              <Switch
                label="Require unlock"
                hint={
                  app.lock
                    ? "Face or fingerprint when you open Homeio"
                    : "Anyone with this phone can open your server"
                }
                checked={app.lock}
                onChange={(next) => bridge()?.setLock(next)}
              />
            </div>
            {/* Only once the server has said where it publishes: a switch that
                cannot lead anywhere is worse than no switch. */}
            {push && (
              <div className="border-b border-white/5">
                <Switch
                  icon={Bell}
                  label="Notifications on this phone"
                  hint={
                    pushState.kind === "on"
                      ? "Alerts arrive with the app closed"
                      : pushState.kind === "off"
                        ? "Subscribe this phone to your server's alerts"
                        : "Turn push on in Settings → Notifications first"
                  }
                  checked={pushState.kind === "on"}
                  disabled={pushState.kind === "server-off"}
                  onChange={(next) => {
                    if (pushState.kind === "server-off") return;
                    if (next) bridge()?.setPush?.(pushState.url, pushState.topic);
                    else bridge()?.clearPush?.();
                  }}
                />
              </div>
            )}
            <div className="border-b border-white/5">
              <Switch
                label="Reconnect on open"
                hint={
                  app.autoReconnect
                    ? "Go straight to the server you used last"
                    : "Always start on the server list"
                }
                checked={app.autoReconnect}
                onChange={(next) => {
                  bridge()?.setAutoReconnect(next);
                  setApp(readSettings());
                }}
              />
            </div>
          </>
        )}

        {/* Only inside the app: a browser tab has no launcher to return to, and
            the link would take it to a localhost that is not Homeio. */}
        {inApp && (
          <div>
            <Row
              icon={LogOut}
              label="Disconnect"
              hint="Back to the server list. Your session stays signed in."
              tone="danger"
              onClick={() => {
                window.location.href = LAUNCHER_URL;
              }}
            />
          </div>
        )}
      </section>

      <p className="px-1 text-[11px] text-muted-foreground/70">
        {inApp
          ? "Unlock and reconnect are settings of this phone, not of the server. Turning the lock off asks for your fingerprint."
          : "Open Homeio in the mobile app for app-level settings."}
      </p>
    </div>
  );
}
