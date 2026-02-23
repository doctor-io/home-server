"use client";

import { LockKeyhole, UserRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { withClientTiming } from "@/lib/client/logger";

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await withClientTiming(
        {
          layer: "hook",
          action: "auth.login.submit",
        },
        async () =>
          fetch("/api/auth/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              username,
              password,
            }),
          }),
      );

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
      <div className="mx-auto mb-4 flex size-24 items-center justify-center rounded-full border border-glass-border bg-glass shadow-2xl shadow-black/40 backdrop-blur-2xl">
        <UserRound className="size-11 text-primary" />
      </div>

      <p className="text-xl font-medium text-foreground">Welcome back</p>
      <p className="mb-5 text-xs text-muted-foreground">Sign in to continue</p>

      <form
        className="rounded-2xl border border-glass-border bg-card/85 px-3 py-3 shadow-2xl shadow-black/40 backdrop-blur-2xl"
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
    </div>
  );
}
