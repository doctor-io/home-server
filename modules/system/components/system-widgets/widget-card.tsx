import type { LucideIcon } from "@/components/icons/platform-icons";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type WidgetCardProps = {
  title?: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
};

export function WidgetCard({
  title,
  icon: Icon,
  children,
  className,
}: WidgetCardProps) {
  return (
    <section
      className={cn(
        // A floating panel, like the dock — same token, so peers agree instead of
        // landing 2px apart by accident.
        "relative shrink-0 overflow-hidden rounded-[var(--system-radius-floating)] border border-white/[0.09] p-4",
        className,
      )}
      style={{
        background: "var(--system-surface)",
        backdropFilter: "blur(40px) saturate(160%)",
        boxShadow: "var(--system-shadow-surface), inset 0 1px 0 rgba(255,255,255,0.12)",
      }}
    >
      {/* Subtle accent top highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      {title ? (
        <header className="mb-3.5 flex items-center gap-2">
          {Icon ? (
            <div className="flex size-5 items-center justify-center rounded-md bg-primary/15 ring-1 ring-inset ring-primary/20">
              <Icon className="size-3 text-primary" />
            </div>
          ) : null}
          <h3 className="text-3xs font-semibold uppercase tracking-[0.15em] text-foreground/55">
            {title}
          </h3>
        </header>
      ) : null}
      {children}
    </section>
  );
}
