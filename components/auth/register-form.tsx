"use client";

import Image from "next/image";
import { LockKeyhole, UserRound } from "@/components/icons/platform-icons";
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, confirmPassword }),
      });

      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? "Registration failed");
      }

      router.replace(`/login?registered=1&username=${encodeURIComponent(username)}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  const progressStep = registerProgressSteps[submitStage];

  return (
    <>
      {/* Progress overlay — same card style as login */}
      {isSubmitting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto mb-4 flex size-24 animate-homeio-breathe-glow items-center justify-center rounded-[var(--radius)] border border-white/14 bg-white/10 shadow-2xl shadow-black/45 backdrop-blur-md">
              <Image src="/icon.png" alt="Homeio" width={64} height={64} className="size-16 animate-homeio-breathe blur-[0.25px]" />
            </div>
            <p className="text-xl font-medium text-foreground">{progressStep?.title}</p>
            <p className="mb-5 text-xs text-muted-foreground">{progressStep?.description}</p>
            <div className="rounded-[calc(var(--radius)+0.375rem)] border border-glass-border bg-card/85 px-3 py-3 shadow-2xl shadow-black/40 backdrop-blur-2xl">
              <div className="flex gap-2 mb-3">
                {registerProgressSteps.map((step, index) => (
                  <span
                    key={step.title}
                    className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
                      index <= submitStage ? "bg-primary" : "bg-white/10"
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 border-t-primary animate-spin" />
                <p className="text-xs text-left text-muted-foreground">
                  First setup takes a little longer — Homeio is preparing the App Store in the background.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Register form — same structure as login */}
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex size-24 animate-homeio-breathe-glow items-center justify-center rounded-[var(--radius)] border border-white/14 bg-white/10 shadow-2xl shadow-black/45 backdrop-blur-md">
          <Image src="/icon.png" alt="Homeio" width={64} height={64} className="size-16 animate-homeio-breathe blur-[0.25px]" />
        </div>

        <p className="text-xl font-medium text-foreground">Create account</p>
        <p className="mb-5 text-xs text-muted-foreground">Set up your Homeio instance</p>

        <form
          className="rounded-[calc(var(--radius)+0.375rem)] border border-glass-border bg-card/85 px-3 py-3 shadow-2xl shadow-black/40 backdrop-blur-2xl"
          onSubmit={handleSubmit}
        >
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-glass-border bg-secondary/35 px-3">
            <UserRound className="size-4 shrink-0 text-primary" />
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
            <LockKeyhole className="size-4 shrink-0 text-primary" />
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              className="h-9 w-full border-0 bg-transparent px-0 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
              required
            />
          </div>

          <div className="mb-2 flex items-center gap-2 rounded-xl border border-glass-border bg-secondary/35 px-3">
            <LockKeyhole className="size-4 shrink-0 text-primary" />
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm password"
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
            disabled={
              isSubmitting ||
              !username.trim() ||
              !password.trim() ||
              !confirmPassword.trim() ||
              password !== confirmPassword
            }
            className="w-full rounded-xl bg-primary py-2 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Setting up..." : "Create account"}
          </button>
        </form>
      </div>
    </>
  );
}
