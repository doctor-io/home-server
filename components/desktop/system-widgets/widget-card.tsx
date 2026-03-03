import type { LucideIcon } from "lucide-react";
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
        "rounded-2xl bg-glass border border-glass-border backdrop-blur-xl p-4",
        className,
      )}
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
