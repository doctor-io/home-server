"use client";

import Image from "next/image";
import {
  Eye,
  EyeOff,
  Lock,
  UserRound,
} from "@/components/icons/platform-icons";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

const registerProgressSteps = [
  {
    title: "Creating your account",
    description: "Saving credentials and creating the first session.",
  },
  {
    title: "Preparing storage",
    description: "Creating required folders and workspace paths.",
  },
  {
    title: "Setting up the App Store",
    description: "Downloading and indexing the default catalog.",
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
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] =
    useState(false);

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
        const json = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(json.error ?? "Registration failed");
      }

      router.replace(`/login?registered=1&username=${encodeURIComponent(username)}`);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Registration failed",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const progressStep = registerProgressSteps[submitStage];

  return (
    <>
      {isSubmitting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="w-full max-w-md text-center">
            <div className="mx-auto mb-4 flex w-fit flex-col items-center">
              <div className="system-hero-surface flex size-22 items-center justify-center">
                <Image
                  src="/icon.png"
                  alt="Homeio"
                  width={64}
                  height={64}
                  className="relative z-10 size-[3.2rem] blur-[0.12px]"
                />
              </div>
              <div className="system-pill-surface mt-2 px-3 py-1 text-[10px] tracking-[0.22em] text-foreground/54 uppercase">
                Home server
              </div>
            </div>

            <p className="text-[1.4rem] font-medium tracking-[-0.03em] text-foreground">
              {progressStep?.title}
            </p>
            <p className="mb-4 mt-1 text-[11px] tracking-[0.18em] text-muted-foreground/80 uppercase">
              Setup in progress
            </p>

            <div className="system-soft-surface px-2.5 py-2">
              <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/10" />
              <div className="rounded-[var(--system-radius-control)] px-2 py-2.5 text-left">
                <div className="mb-3.5 flex gap-2">
                  {registerProgressSteps.map((step, index) => (
                    <span
                      key={step.title}
                      className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
                        index <= submitStage ? "bg-white" : "bg-white/10"
                      }`}
                    />
                  ))}
                </div>

                <p className="text-sm font-medium text-foreground">
                  {progressStep?.description}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground/92">
                  First launch may take longer while background services finish
                  initialization.
                </p>

                <div className="mt-3.5 flex items-center gap-3">
                  <span className="inline-flex size-8 shrink-0 rounded-full border border-white/18 border-t-white animate-spin" />
                  <span className="text-xs tracking-[0.18em] text-foreground/62 uppercase">
                    Working
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className={`w-full max-w-md text-center ${isSubmitting ? "invisible" : ""}`}>
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
          Create admin account
        </p>
        <p className="mb-5 mt-1 text-[11px] tracking-[0.18em] text-muted-foreground/78 uppercase">
          Configure local access
        </p>

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
                  placeholder="Admin username"
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
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="New password"
                  className="h-10 w-full border-0 bg-transparent px-1 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/52"
                  required
                />
                <button
                  type="button"
                  className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[var(--system-radius-icon)] text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  aria-label={
                    isPasswordVisible ? "Hide password" : "Show password"
                  }
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

              <div className="flex items-center gap-2 rounded-[var(--system-radius-control)] border border-white/6 bg-white/[0.035] px-2 py-1.5 transition-colors hover:bg-white/[0.05] focus-within:bg-white/[0.05]">
                <div className="system-icon-surface flex size-9 shrink-0 items-center justify-center bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <Lock className="size-[1.2rem]" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={isConfirmPasswordVisible ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm new password"
                  className="h-10 w-full border-0 bg-transparent px-1 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/52"
                  required
                />
                <button
                  type="button"
                  className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[var(--system-radius-icon)] text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  aria-label={
                    isConfirmPasswordVisible
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                  onClick={() =>
                    setIsConfirmPasswordVisible((currentValue) => !currentValue)
                  }
                >
                  {isConfirmPasswordVisible ? (
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
              !username.trim() ||
              !password.trim() ||
              !confirmPassword.trim() ||
              password !== confirmPassword
            }
            className="system-primary-action w-full cursor-pointer rounded-full py-2.5 text-sm font-medium transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Initializing..." : "Create account"}
          </button>
        </form>
      </div>
    </>
  );
}
