import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type AuthCardProps = {
  children: ReactNode;
  className?: string;
};

/**
 * The frosted panel the auth screens sit on. Shares the shell's glass tokens so
 * the deep shadow and the top-left edge highlight stay in sync with the rest of
 * the system rather than drifting per-page.
 */
export function AuthCard({ children, className }: AuthCardProps) {
  return (
    <div
      className={cn(
        "system-surface animate-homeio-surface-in w-full max-w-[26rem] px-6 py-8 sm:px-8 sm:py-10",
        className,
      )}
      data-testid="auth-card"
    >
      {children}
    </div>
  );
}
