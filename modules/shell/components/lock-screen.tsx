"use client";

import Image from "next/image";
import { FullScreenShell } from "@/modules/shell/components/full-screen-shell";
import { LockKeyhole, Power } from "@/components/icons/platform-icons";
import { type FormEvent, useState } from "react";

type LockScreenProps = {
  onUnlock: (password: string) => Promise<void>;
  onLogout: () => Promise<void>;
  username: string;
  wallpaper?: string;
};

export function LockScreen({
  onUnlock,
  onLogout,
  username,
  wallpaper = "/images/1.jpg",
}: LockScreenProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password.trim()) return;

    setError(null);
    setIsUnlocking(true);

    try {
      await onUnlock(password);
      setPassword("");
    } catch (unlockError) {
      setError(
        unlockError instanceof Error ? unlockError.message : "Unlock failed",
      );
    } finally {
      setIsUnlocking(false);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[500]">
      <FullScreenShell
        wallpaper={wallpaper}
        topRight={
          <button
            className="rounded-lg border border-glass-border bg-glass p-2 text-muted-foreground backdrop-blur-xl transition-colors hover:bg-secondary/50 hover:text-foreground disabled:opacity-60"
            aria-label="Logout"
            title="Logout"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <Power className="size-4" />
          </button>
        }
        center={
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto mb-4 flex size-24 animate-homeio-breathe-glow items-center justify-center rounded-[var(--radius)] border border-white/14 bg-white/10 shadow-2xl shadow-black/45 backdrop-blur-md">
              <Image src="/icon.png" alt="Homeio" width={64} height={64} className="size-16 animate-homeio-breathe blur-[0.25px]" />
            </div>

            <p className="text-xl font-medium text-foreground">{username}</p>
            <p className="mb-5 text-xs text-muted-foreground">Locked session</p>

            <form
              className="rounded-[calc(var(--radius)+0.375rem)] border border-glass-border bg-card/85 px-3 py-3 shadow-2xl shadow-black/40 backdrop-blur-2xl"
              onSubmit={handleUnlock}
            >
              <div className="mb-2 flex items-center gap-2 rounded-xl border border-glass-border bg-secondary/35 px-3">
                <LockKeyhole className="size-4 text-primary" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="h-9 w-full border-0 bg-transparent px-0 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                  autoFocus
                />
              </div>

              {error ? (
                <p className="mb-2 rounded-lg border border-status-red/30 bg-status-red/10 px-3 py-2 text-xs text-status-red">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                className="pointer-events-auto w-full rounded-xl bg-primary py-2 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isUnlocking || !password.trim()}
              >
                {isUnlocking ? "Unlocking..." : "Unlock"}
              </button>
            </form>

            <p className="mt-3 text-xs text-muted-foreground">
              Press Command + L anytime to lock
            </p>
          </div>
        }
      />
    </div>
  );
}
