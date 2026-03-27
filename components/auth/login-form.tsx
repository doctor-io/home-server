"use client";

import Image from "next/image";
import Link from "next/link";
import { LockKeyhole, UserRound } from "@/components/icons/platform-icons";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";

const RESTORE_BANNER_KEY = "homeio:restore-banner";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => {
    const requested = searchParams.get("next") ?? "/";
    return requested.startsWith("/") ? requested : "/";
  }, [searchParams]);

  const [username, setUsername] = useState(
    () => searchParams.get("username")?.trim().toLowerCase() ?? "",
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);

  // Check if the user was redirected here after a restore completed and their
  // session was invalidated. Show a one-shot banner so they know why their
  // current password may not work (the backup's password hash is now active).
  useEffect(() => {
    try {
      if (window.localStorage.getItem(RESTORE_BANNER_KEY)) {
        window.localStorage.removeItem(RESTORE_BANNER_KEY);
        setShowRestoreBanner(true);
      }
    } catch {
      // Best-effort only.
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as {
          error?: string;
        };

        throw new Error(json.error ?? "Login failed");
      }

      router.replace(nextPath);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Login failed",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-sm text-center">
      <div className="mx-auto mb-4 flex size-24 animate-homeio-breathe-glow items-center justify-center rounded-[var(--radius)] border border-white/14 bg-white/10 shadow-2xl shadow-black/45 backdrop-blur-md">
        <Image src="/icon.png" alt="Homeio" width={64} height={64} className="size-16 animate-homeio-breathe blur-[0.25px]" />
      </div>

      <p className="text-xl font-medium text-foreground">Welcome back</p>
      <p className="mb-5 text-xs text-muted-foreground">Sign in to continue</p>

      {showRestoreBanner ? (
        <div className="mb-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2.5 text-left text-xs text-yellow-300">
          <p className="font-medium">Restore complete — session reset</p>
          <p className="mt-0.5 text-yellow-300/80">
            Please sign in with the credentials that were active when this backup was taken.
          </p>
        </div>
      ) : null}

      <form
        className="rounded-[calc(var(--radius)+0.375rem)] border border-glass-border bg-card/85 px-3 py-3 shadow-2xl shadow-black/40 backdrop-blur-2xl"
        onSubmit={handleSubmit}
      >
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-glass-border bg-secondary/35 px-3">
          <UserRound className="size-4 text-primary" />
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Username"
            className="h-9 w-full border-0 bg-transparent px-0 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
            required
            autoFocus
          />
        </div>

        <div className="mb-2 flex items-center gap-2 rounded-xl border border-glass-border bg-secondary/35 px-3">
          <LockKeyhole className="size-4 text-primary" />
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className="h-9 w-full border-0 bg-transparent px-0 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
            required
          />
        </div>

        {error ? (
          <p className="mb-2 rounded-lg border border-status-red/30 bg-status-red/10 px-3 py-2 text-xs text-status-red">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || !username.trim() || !password.trim()}
          className="w-full rounded-xl bg-primary py-2 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Signing in..." : "Login"}
        </button>
      </form>

      <p className="mt-4 text-xs text-muted-foreground">
        First time?{" "}
        <Link href="/register" className="text-primary underline-offset-2 hover:underline">
          Set up Homeio
        </Link>
      </p>
    </div>
  );
}
