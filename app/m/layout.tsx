import type { ReactNode } from "react";
import { RealtimeBootstrap } from "@/components/providers/realtime-bootstrap";
import { StoreActionsProvider } from "@/modules/apps/hooks/StoreActionsContext";
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
    <StoreActionsProvider>
    {/* A height, not a minimum. With min-h the column grows to fit its content,
        so a screen that wants to scroll one region internally cannot: everything
        above it grows too and the document scrolls instead. 100dvh shrinks with
        the keyboard, which is what the terminal depends on. */}
    <div className="flex h-[100dvh] flex-col bg-background text-foreground">
      {/* The same SSE stream the desktop uses. useSystemMetrics holds its cache
          with staleTime: Infinity and expects this to push updates into it —
          without it the phone would show one snapshot and then never move. */}
      <RealtimeBootstrap />
      <main
        // pb-6 rather than clearing a fixed bar: the tab bar is a flex sibling
        // now, so it takes its own space.
        // A flex column, so a screen that wants to own its own scrolling can
        // stretch to the viewport (Monitor does); the rest size to content and
        // scroll this element as before.
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6"
        // Clear of the notch at the top; the tab bar handles the bottom.
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
      >
        {children}
      </main>
      <PhoneTabBar />
    </div>
    </StoreActionsProvider>
  );
}
