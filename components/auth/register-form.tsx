"use client";

import { AuthCard } from "@/components/auth/auth-card";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

const registerProgressSteps = [
  {
    title: "Creating your account",
    description: "Saving your login and preparing your workspace.",
  },
  {
    title: "Preparing storage",
    description: "Creating the data folders Homeio needs before first use.",
  },
  {
    title: "Setting up the App Store",
    description:
      "Downloading and indexing the default CasaOS catalog. This can take a moment.",
  },
] as const;

export function RegisterForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState(0);

  useEffect(() => {
    if (!isSubmitting) {
      setSubmitStage(0);
      return;
    }

    const stageTimers = [
      window.setTimeout(() => setSubmitStage(1), 1200),
      window.setTimeout(() => setSubmitStage(2), 3200),
    ];

    return () => {
      for (const timer of stageTimers) {
        window.clearTimeout(timer);
      }
    };
  }, [isSubmitting]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
          confirmPassword,
        }),
      });

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

  const progressStep = registerProgressSteps[submitStage];

  return (
    <>
      {isSubmitting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-6 backdrop-blur-xl">
          <div className="w-full max-w-md rounded-[calc(var(--radius)+0.75rem)] border border-primary/20 bg-card/95 p-6 shadow-2xl shadow-black/40">
            <div className="flex items-start gap-4">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[var(--radius)] border-2 border-primary/30 border-t-primary animate-spin" />
              <div className="min-w-0">
                <p className="text-lg font-semibold text-foreground">
                  {progressStep?.title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {progressStep?.description}
                </p>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              {registerProgressSteps.map((step, index) => (
                <span
                  key={step.title}
                  className={`h-2 flex-1 rounded-[var(--radius)] transition-colors ${
                    index <= submitStage ? "bg-primary" : "bg-white/10"
                  }`}
                />
              ))}
            </div>
            <div className="mt-4 space-y-2 text-xs text-muted-foreground">
              <p>
                This first setup can take a little longer than a normal sign up.
              </p>
              <p>
                Homeio is preparing the default App Store in the background so
                the system is ready right after login.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <AuthCard title="Create account" description="Create your account">
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor="username"
            >
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
            <label
              className="text-sm font-medium text-foreground"
              htmlFor="password"
            >
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
            <label
              className="text-sm font-medium text-foreground"
              htmlFor="confirmPassword"
            >
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
            {isSubmitting ? "Finishing setup..." : "Register"}
          </button>
        </form>
      </AuthCard>
    </>
  );
}
