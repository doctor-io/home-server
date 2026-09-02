"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, LayoutGrid, LockKeyhole, LogOut, Server } from "@/components/icons/platform-icons";

/**
 * The launcher stamps this on the WebView's user agent (capacitor.config.ts).
 * It is the only signal available here: Homeio is served from the server's
 * origin, and Capacitor's bridge is injected into the app's own origin only, so
 * `window.Capacitor` never exists on this page.
 */
const APP_USER_AGENT_MARKER = "HomeioApp";

/** Where the launcher lives inside the app, and the flag that stops it bouncing back. */
const LAUNCHER_URL = "http://localhost/?disconnect=1";

/** Same origin hop, but keeping the connection: it opens the app's own settings. */
const LAUNCHER_SETTINGS_URL = "http://localhost/?settings=1";

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

  useEffect(() => {
    setInApp(navigator.userAgent.includes(APP_USER_AGENT_MARKER));
    setOrigin(window.location.host);
  }, []);

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

        {/* The unlock and reconnect switches cannot live on this page: it is
            served from the server's origin, where the app's storage is not
            reachable. So this goes and opens them where they do live. */}
        {inApp && (
          <div className="border-b border-white/5">
            <Row
              icon={LockKeyhole}
              label="App settings"
              hint="Require unlock, reconnect on open"
              onClick={() => {
                window.location.href = LAUNCHER_SETTINGS_URL;
              }}
            />
          </div>
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
          ? "App settings belong to this phone, not to the server, so they open in the app itself."
          : "Open Homeio in the mobile app for app-level settings."}
      </p>
    </div>
  );
}
