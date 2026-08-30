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
      // element inside a dynamic-viewport (100dvh) container.
      className="shrink-0 border-t border-glass-border bg-[#0b0d10]"
      // Sits above the gesture bar rather than under it.
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="flex items-stretch">
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
                className={cn(
                  "flex min-h-[3.25rem] flex-col items-center justify-center gap-1 text-[10px] transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
