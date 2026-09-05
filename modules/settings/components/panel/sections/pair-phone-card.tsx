"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Maximize2, RefreshCw } from "@/components/icons/platform-icons";
import { cn } from "@/lib/utils";
import { SETTINGS_PANEL_INSET } from "@/modules/settings/components/panel/surface";
import { SectionDivider } from "@/modules/settings/components/panel/controls";

type Pairing = {
  url: string;
  qrSvg: string;
  expiresAt: string;
};

/**
 * The QR is a credential for as long as it is on screen, so the countdown is
 * not decoration — it tells the operator how long the thing they are holding up
 * to a room stays live, and the code is gone from the screen the moment it
 * stops being valid.
 */
function secondsLeft(expiresAt: string) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export function PairPhoneCard({ isDemoMode }: { isDemoMode?: boolean }) {
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mint = useCallback(async () => {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/auth/pairing", { method: "POST" });
      if (!response.ok) throw new Error("Could not create a pairing code");

      const json = (await response.json()) as { data: Pairing };
      setPairing(json.data);
      setRemaining(secondsLeft(json.data.expiresAt));
    } catch (mintError) {
      setError(mintError instanceof Error ? mintError.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!pairing) return;

    const timer = setInterval(() => {
      const left = secondsLeft(pairing.expiresAt);
      setRemaining(left);
      // Drop the code itself, not just the number: an expired QR that stays on
      // screen invites someone to scan it and wonder why nothing happened.
      if (left === 0) setPairing(null);
    }, 500);

    return () => clearInterval(timer);
  }, [pairing]);

  return (
    <>
      <SectionDivider title="Mobile app" />

      <div className={cn(SETTINGS_PANEL_INSET, "flex flex-col gap-3 px-4 py-3")}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm text-foreground">Pair a phone</div>
            <div className="mt-0.5 text-2xs text-muted-foreground/70">
              Scan from the Homeio app to add this server and sign in, without typing an
              address or a password on a touchscreen.
            </div>
          </div>

          {!pairing && (
            <button
              type="button"
              onClick={() => void mint()}
              disabled={busy || isDemoMode}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary/90 px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              <Maximize2 className="size-3.5" />
              {busy ? "Preparing…" : "Show QR"}
            </button>
          )}
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-2xs text-status-red" role="alert">
            <AlertTriangle className="size-3.5" /> {error}
          </p>
        )}

        {pairing && (
          <div className="flex flex-col gap-3 md:flex-row md:items-start">
            <div
              className="mx-auto size-44 shrink-0 rounded-xl bg-white p-2 md:mx-0"
              // Same reasoning as the two-factor card: the endpoint returns a
              // fully-formed <svg> the server controls end to end.
              dangerouslySetInnerHTML={{ __html: pairing.qrSvg }}
            />

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-foreground">
                Open the Homeio app and scan this
              </p>
              <p className="text-2xs text-muted-foreground/80">
                It carries this server&apos;s address and a one-time code. The phone is
                signed in as you — treat the screen like a password while it is up.
              </p>

              <p
                className={cn(
                  "text-2xs tabular-nums",
                  remaining <= 10 ? "text-status-amber" : "text-muted-foreground/70",
                )}
              >
                Expires in {remaining}s · single use
              </p>

              <button
                type="button"
                onClick={() => void mint()}
                disabled={busy}
                className="inline-flex w-fit items-center gap-1.5 text-2xs text-muted-foreground/80 hover:text-foreground disabled:opacity-50"
              >
                <RefreshCw className={cn("size-3", busy && "animate-spin")} />
                New code
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
