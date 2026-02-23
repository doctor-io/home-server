"use client";

import { LockKeyhole, Power, UserRound } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

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
  const [now, setNow] = useState(new Date());
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('${wallpaper}')` }}
      />
      <div className="absolute inset-0 bg-background/70 backdrop-blur-xl" />

      <div className="pointer-events-none absolute inset-x-0 top-16 text-center">
        <p className="text-6xl font-semibold tracking-tight text-foreground/95 font-mono">
          {now.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {now.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      <button
        className="absolute right-5 top-5 rounded-lg border border-glass-border bg-glass p-2 text-muted-foreground backdrop-blur-xl transition-colors hover:bg-secondary/50 hover:text-foreground disabled:opacity-60"
        aria-label="Logout"
        title="Logout"
        onClick={handleLogout}
        disabled={isLoggingOut}
      >
        <Power className="size-4" />
      </button>

      <div className="relative flex h-full w-full items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex size-24 items-center justify-center rounded-full border border-glass-border bg-glass shadow-2xl shadow-black/40 backdrop-blur-2xl">
            <UserRound className="size-11 text-primary" />
          </div>

          <p className="text-xl font-medium text-foreground">{username}</p>
          <p className="mb-5 text-xs text-muted-foreground">Locked session</p>

          <form
            className="rounded-2xl border border-glass-border bg-card/85 px-3 py-3 shadow-2xl shadow-black/40 backdrop-blur-2xl"
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
      </div>
    </div>
  );
}
