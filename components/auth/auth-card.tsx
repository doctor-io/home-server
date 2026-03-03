import type { ReactNode } from "react";

type AuthCardProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-glass-border bg-card/90 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-6">{children}</div>
      {footer ? <div className="mt-5 text-sm text-muted-foreground">{footer}</div> : null}
    </div>
  );
}
