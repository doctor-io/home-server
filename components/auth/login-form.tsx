"use client";

import Image from "next/image";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  UserRound,
} from "@/components/icons/platform-icons";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";

const RESTORE_BANNER_KEY = "homeio:restore-banner";
const DEFAULT_RETRY_DELAY_SECONDS = 3;

const DEMO_USERNAME = "homeio";
const DEMO_PASSWORD = "homeio26";

export function LoginForm({ isDemoMode = false }: { isDemoMode?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => {
    const requested = searchParams.get("next") ?? "/";
    return requested.startsWith("/") ? requested : "/";
  }, [searchParams]);

  const [username, setUsername] = useState(
    () => isDemoMode ? DEMO_USERNAME : (searchParams.get("username")?.trim().toLowerCase() ?? ""),
  );
  const [password, setPassword] = useState(
    () => isDemoMode ? DEMO_PASSWORD : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(0);

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

  useEffect(() => {
    if (retryCountdown <= 0) return;

    const timeoutId = window.setTimeout(() => {
      setRetryCountdown((currentValue) => Math.max(0, currentValue - 1));
    }, 1_000);

    return () => window.clearTimeout(timeoutId);
  }, [retryCountdown]);

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
          retryAfterSeconds?: number;
        };
        const retryAfterHeader = response.headers.get("retry-after");
        const parsedRetryAfter = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : NaN;
        const retryAfterSeconds = Number.isFinite(parsedRetryAfter) && parsedRetryAfter > 0
          ? parsedRetryAfter
          : json.retryAfterSeconds && json.retryAfterSeconds > 0
            ? json.retryAfterSeconds
            : response.status === 401
              ? DEFAULT_RETRY_DELAY_SECONDS
              : 0;

        if (retryAfterSeconds > 0) {
          setRetryCountdown(retryAfterSeconds);
        }

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
    <div className="w-full max-w-md text-center">
      <div className="mx-auto mb-5 flex w-fit flex-col items-center">
        <div className="system-hero-surface flex size-[5.5rem] items-center justify-center">
          <Image
            src="/icon.png"
            alt="Homeio"
            width={64}
            height={64}
            className="relative z-10 size-[3.4rem] blur-[0.12px]"
          />
        </div>
        <div className="system-pill-surface mt-2 px-3 py-1 text-[10px] tracking-[0.22em] text-foreground/54 uppercase">
          Home server
        </div>
      </div>

      <p className="text-[1.48rem] font-medium tracking-[-0.03em] text-foreground">
        Welcome back
      </p>
      <p className="mb-5 mt-1 text-[11px] tracking-[0.18em] text-muted-foreground/78 uppercase">
        Sign in to continue
      </p>

      {isDemoMode ? (
        <div className="mb-3 rounded-[var(--system-radius-control)] border border-white/10 bg-black/22 px-4 py-3 text-left text-xs text-foreground/70 shadow-[var(--system-shadow-surface)] backdrop-blur-2xl">
          <p className="font-medium tracking-[0.02em] text-foreground/90">Demo mode</p>
          <p className="mt-0.5 leading-5">
            Username: <span className="font-mono text-foreground/90">{DEMO_USERNAME}</span>
            {" · "}Password: <span className="font-mono text-foreground/90">{DEMO_PASSWORD}</span>
          </p>
        </div>
      ) : null}

      {showRestoreBanner ? (
        <div className="mb-3 rounded-[var(--system-radius-control)] border border-yellow-500/18 bg-black/22 px-4 py-3 text-left text-xs text-yellow-300 shadow-[var(--system-shadow-surface)] backdrop-blur-2xl">
          <p className="font-medium tracking-[0.02em]">
            Restore complete, session reset
          </p>
          <p className="mt-1 leading-5 text-yellow-300/78">
            Please sign in with the credentials that were active when this backup was taken.
          </p>
        </div>
      ) : null}

      <form className="space-y-3" onSubmit={handleSubmit}>
        <div className="system-soft-surface px-2.5 py-2">
          <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/10" />
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 rounded-[var(--system-radius-control)] border border-white/6 bg-white/[0.035] px-2 py-1.5 transition-colors hover:bg-white/[0.05] focus-within:bg-white/[0.05]">
              <div className="system-icon-surface flex size-9 shrink-0 items-center justify-center bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <UserRound className="size-[1.1rem]" />
              </div>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Username"
                className="h-10 w-full border-0 bg-transparent px-1 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/52"
                required
                autoFocus
              />
            </div>

            <div className="flex items-center gap-2 rounded-[var(--system-radius-control)] border border-white/6 bg-white/[0.035] px-2 py-1.5 transition-colors hover:bg-white/[0.05] focus-within:bg-white/[0.05]">
              <div className="system-icon-surface flex size-9 shrink-0 items-center justify-center bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <Lock className="size-[1.2rem]" />
              </div>
              <input
                id="password"
                name="password"
                type={isPasswordVisible ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                className="h-10 w-full border-0 bg-transparent px-1 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/52"
                required
              />
              <button
                type="button"
                className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[var(--system-radius-icon)] text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                aria-pressed={isPasswordVisible}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() =>
                  setIsPasswordVisible((currentValue) => !currentValue)
                }
              >
                {isPasswordVisible ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="flex justify-center">
            <div className="system-error-capsule">
              <span className="size-1.5 shrink-0 rounded-full bg-status-red shadow-[0_0_10px_rgba(239,68,68,0.45)]" />
              <p className="text-xs tracking-[0.01em] text-status-red/92">
                {error}
              </p>
            </div>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={
            isSubmitting ||
            retryCountdown > 0 ||
            !username.trim() ||
            !password.trim()
          }
          className="system-primary-action group flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-medium transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span>
            {isSubmitting
              ? "Signing in..."
              : retryCountdown > 0
                ? `Try again in ${retryCountdown}s`
                : "Sign in"}
          </span>
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </form>
    </div>
  );
}
