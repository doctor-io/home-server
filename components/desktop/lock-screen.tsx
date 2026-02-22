"use client";

import { LockKeyhole, Mail, Power, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

type LockScreenProps = {
  onUnlock: () => void;
  wallpaper?: string;
};

export function LockScreen({
  onUnlock,
  wallpaper = "/images/wallpaper.jpg",
}: LockScreenProps) {
  const [now, setNow] = useState(new Date());
  const [mode, setMode] = useState<"lock" | "login" | "signup">("lock");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  function handleUnlock() {
    if (!password.trim()) return;
    setPassword("");
    onUnlock();
  }

  function handlePrimaryAction() {
    if (mode === "lock") {
      handleUnlock();
      return;
    }

    if (mode === "login") {
      if (!email.trim() || !password.trim()) return;
      setPassword("");
      onUnlock();
      return;
    }

    if (!name.trim() || !email.trim() || !password.trim()) return;
    setMode("login");
    setPassword("");
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
        className="absolute right-5 top-5 rounded-lg border border-glass-border bg-glass p-2 text-muted-foreground backdrop-blur-xl transition-colors hover:bg-secondary/50 hover:text-foreground"
        aria-label="Power options"
      >
        <Power className="size-4" />
      </button>

      <div className="relative flex h-full w-full items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex size-24 items-center justify-center rounded-full border border-glass-border bg-glass shadow-2xl shadow-black/40 backdrop-blur-2xl">
            <UserRound className="size-11 text-primary" />
          </div>
          <p className="text-xl font-medium text-foreground">
            {mode === "signup"
              ? "Create Account"
              : mode === "login"
                ? "Login"
                : "admin"}
          </p>
          <p className="mb-5 text-xs text-muted-foreground">
            {mode === "signup"
              ? "Join serverlab.local"
              : mode === "login"
                ? "Sign in to continue"
                : "serverlab.local"}
          </p>

          <div className="rounded-2xl border border-glass-border bg-card/85 px-3 py-3 shadow-2xl shadow-black/40 backdrop-blur-2xl">
            <div className="mb-3 flex items-center gap-1 rounded-lg bg-glass p-0.5">
              {[
                { id: "lock" as const, label: "Lock" },
                { id: "login" as const, label: "Login" },
                { id: "signup" as const, label: "Sign up" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setMode(item.id)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-all ${
                    mode === item.id
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {mode === "signup" && (
              <div className="mb-2 flex items-center gap-2 rounded-xl border border-glass-border bg-secondary/35 px-3">
                <UserRound className="size-4 text-primary" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className="h-9 w-full border-0 bg-transparent px-0 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                />
              </div>
            )}

            {mode !== "lock" && (
              <div className="mb-2 flex items-center gap-2 rounded-xl border border-glass-border bg-secondary/35 px-3">
                <Mail className="size-4 text-primary" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="h-9 w-full border-0 bg-transparent px-0 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                />
              </div>
            )}

            <div className="mb-2 flex items-center gap-2 rounded-xl border border-glass-border bg-secondary/35 px-3">
              <LockKeyhole className="size-4 text-primary" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handlePrimaryAction();
                }}
                placeholder={mode === "lock" ? "Enter password" : "Password"}
                className="h-9 w-full border-0 bg-transparent px-0 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                autoFocus
              />
            </div>

            <button
              onClick={handlePrimaryAction}
              className="pointer-events-auto w-full rounded-xl bg-primary py-2 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                mode === "lock"
                  ? !password.trim()
                  : mode === "login"
                    ? !email.trim() || !password.trim()
                    : !name.trim() || !email.trim() || !password.trim()
              }
            >
              {mode === "lock"
                ? "Unlock"
                : mode === "login"
                  ? "Login"
                  : "Create account"}
            </button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Press Command + L anytime to lock
          </p>
        </div>
      </div>
    </div>
  );
}
