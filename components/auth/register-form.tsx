"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { withClientTiming } from "@/lib/client/logger";
import { AuthCard } from "@/components/auth/auth-card";

export function RegisterForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
          action: "auth.register.submit",
        },
        async () =>
          fetch("/api/auth/register", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              username,
              password,
              confirmPassword,
            }),
          }),
      );

      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as {
          error?: string;
        };

        throw new Error(json.error ?? "Registration failed");
      }

      const loginUrl = `/login?registered=1&username=${encodeURIComponent(username)}`;
      router.replace(loginUrl);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Registration failed",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Create account"
      description="Create your account"
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="h-10 w-full rounded-lg border border-glass-border bg-secondary/35 px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-10 w-full rounded-lg border border-glass-border bg-secondary/35 px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground" htmlFor="confirmPassword">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-10 w-full rounded-lg border border-glass-border bg-secondary/35 px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
            required
          />
        </div>

        {error ? (
          <p className="rounded-lg border border-status-red/30 bg-status-red/10 px-3 py-2 text-sm text-status-red">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={
            isSubmitting ||
            !username.trim() ||
            !password.trim() ||
            !confirmPassword.trim() ||
            password !== confirmPassword
          }
          className="h-10 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Creating account..." : "Register"}
        </button>
      </form>
    </AuthCard>
  );
}
