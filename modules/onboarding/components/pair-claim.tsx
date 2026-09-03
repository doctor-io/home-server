"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type State = "claiming" | "failed";

export function PairClaim() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const [state, setState] = useState<State>("claiming");
  const [message, setMessage] = useState("Signing this device in…");
  // A code is spent by the first request that reaches it, so a second attempt
  // would fail and show an error for a pairing that actually worked. React's
  // development double-effect makes that a certainty rather than a race.
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    if (!code) {
      setState("failed");
      setMessage("This link has no pairing code.");
      return;
    }

    async function claim() {
      try {
        const response = await fetch("/api/v1/auth/pairing/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          setState("failed");
          setMessage(
            body.error ??
              "That pairing code is not valid. Show a new QR on the server and scan again.",
          );
          return;
        }

        // replace, not assign: the code is spent, so this page must not be
        // somewhere the back button can return to.
        window.location.replace("/m");
      } catch {
        setState("failed");
        setMessage("Could not reach the server to finish pairing.");
      }
    }

    void claim();
  }, [code]);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground">
      <p className={state === "failed" ? "text-sm text-status-red" : "text-sm"}>{message}</p>

      {state === "failed" && (
        <a href="/login" className="text-[12px] text-primary">
          Sign in instead
        </a>
      )}
    </main>
  );
}
