"use client";

import { cn } from "@/lib/utils";
import { useResolvedWallpaper } from "@/modules/shell/hooks/useResolvedWallpaper";
import { type ReactNode, useEffect, useState } from "react";

type FullScreenShellProps = {
  center: ReactNode;
  bottom?: ReactNode;
  topRight?: ReactNode;
  wallpaper?: string;
  showClock?: boolean;
  centerClassName?: string;
  bottomClassName?: string;
};

export function FullScreenShell({
  center,
  bottom,
  topRight,
  wallpaper,
  showClock = true,
  centerClassName,
  bottomClassName,
}: FullScreenShellProps) {
  const [now, setNow] = useState<Date | null>(null);
  const { wallpaper: storedWallpaper } = useResolvedWallpaper();
  const resolvedWallpaper = wallpaper ?? storedWallpaper;

  useEffect(() => {
    setNow(new Date());
    if (!showClock) return;

    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [showClock]);

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-background text-white"
      data-testid="full-screen-shell"
    >
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 scale-110 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url('${resolvedWallpaper}')` }}
          data-testid="full-screen-wallpaper"
        />
        <div className="absolute inset-0 bg-background/58 backdrop-blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.14)_46%,rgba(0,0,0,0.42)_100%)]" />
      </div>

      {topRight ? (
        <div className="absolute right-5 top-5 z-10">{topRight}</div>
      ) : null}

      <div className="relative flex min-h-screen flex-col px-6">
        {showClock ? (
          <div
            className="pointer-events-none absolute inset-x-0 top-16 text-center"
            data-testid="full-screen-clock"
          >
            <p className="text-6xl font-semibold tracking-tight text-foreground/95 font-mono">
              {now
                ? now.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "--:--"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {now
                ? now.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : "\u00a0"}
            </p>
          </div>
        ) : null}

        <div
          className={cn(
            "flex flex-1 items-center justify-center",
            bottom ? "pt-14 sm:pt-16" : "",
            centerClassName,
          )}
        >
          {center}
        </div>

        {bottom ? (
          <div
            className={cn("pb-10 sm:pb-14", bottomClassName)}
            data-testid="full-screen-bottom"
          >
            {bottom}
          </div>
        ) : null}
      </div>
    </main>
  );
}
