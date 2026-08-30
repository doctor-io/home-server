import type { ReactNode } from "react";
import { RealtimeBootstrap } from "@/components/providers/realtime-bootstrap";
import { PhoneTabBar } from "@/modules/phone/components/phone-tab-bar";

export const dynamic = "force-dynamic";

/**
 * The phone UI. A separate route rather than a responsive desktop shell: the
 * shell is a desktop metaphor — windows, a dock, drag-to-move — and shrinking
 * it would thread breakpoints through the window manager and every panel. This
 * shares the session, the API and the hooks, and leaves the desktop untouched.
 *
 * Auth needs no work here: /m is not in the proxy's public list, so an
 * unauthenticated visit redirects to /login exactly as / does.
 */
export default function PhoneLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      {/* The same SSE stream the desktop uses. useSystemMetrics holds its cache
          with staleTime: Infinity and expects this to push updates into it —
          without it the phone would show one snapshot and then never move. */}
      <RealtimeBootstrap />
      <main
        // pb-6 rather than clearing a fixed bar: the tab bar is a flex sibling
        // now, so it takes its own space.
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-6"
        // Clear of the notch at the top; the tab bar handles the bottom.
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
      >
        {children}
      </main>
      <PhoneTabBar />
    </div>
  );
}
