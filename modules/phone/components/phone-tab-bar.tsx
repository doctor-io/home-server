"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Folder,
  Home,
  Package,
  TerminalSquare,
} from "@/components/icons/platform-icons";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/m", label: "Home", icon: Home },
  { href: "/m/monitor", label: "Monitor", icon: Activity },
  { href: "/m/apps", label: "Apps", icon: Package },
  { href: "/m/files", label: "Files", icon: Folder },
  { href: "/m/terminal", label: "Terminal", icon: TerminalSquare },
];

export function PhoneTabBar() {
  const pathname = usePathname();

  return (
    <nav
      // Not position:fixed. The layout is already a flex column with a
      // scrolling <main>, so the bar sits naturally at the end — and Android's
      // WebView leaves a ghost band at the top of the screen for a fixed
      // element inside a dynamic-viewport (100dvh) container. The dock look is
      // margin and a radius, not positioning.
      className="shrink-0 px-3 pt-1"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
    >
      <ul className="flex items-stretch gap-0.5 rounded-[1.6rem] bg-[#14171b] p-1.5 shadow-[0_-2px_24px_-8px_rgba(0,0,0,0.9)] ring-1 ring-white/8">
        {TABS.map((tab) => {
          // Exact match for Home, prefix for the rest, so /m/apps/x stays lit.
          const isActive = tab.href === "/m" ? pathname === "/m" : pathname.startsWith(tab.href);
          const Icon = tab.icon;

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                // 44px minimum: anything smaller is a miss on a phone.
                className="relative flex min-h-[3.1rem] flex-col items-center justify-center gap-1 rounded-[1.15rem] transition-transform active:scale-95"
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-[1.15rem] bg-gradient-to-b from-primary/20 to-primary/6 ring-1 ring-primary/25"
                  />
                )}

                {/* The icons are images, not glyphs, so a text colour never
                    reaches them. Colour is the active state instead: the
                    resting tabs are drained and dimmed, the current one is not. */}
                <Icon
                  className={cn(
                    "relative size-5 transition duration-200",
                    isActive ? "scale-110" : "opacity-45 grayscale",
                  )}
                />
                <span
                  className={cn(
                    "relative text-3xs transition-colors",
                    isActive ? "font-medium text-primary" : "text-muted-foreground/70",
                  )}
                >
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
