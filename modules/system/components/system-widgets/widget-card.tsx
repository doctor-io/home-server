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
        "shrink-0 rounded-2xl border border-white/[0.09] p-4",
        className,
      )}
      style={{
        background: "var(--system-surface)",
        backdropFilter: "blur(40px) saturate(160%)",
        boxShadow: "var(--system-shadow-surface), inset 0 1px 0 rgba(255,255,255,0.12)",
      }}
    >
      {title ? (
        <header className="flex items-center gap-2 mb-3">
          {Icon ? <Icon className="size-4 text-primary" /> : null}
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            {title}
          </h3>
        </header>
      ) : null}
      {children}
    </section>
  );
}
