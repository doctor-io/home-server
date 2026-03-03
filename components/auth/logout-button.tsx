"use client";

import { LogOut } from "lucide-react";

type LogoutButtonProps = {
  onLogout: () => void;
  isPending?: boolean;
};

export function LogoutButton({ onLogout, isPending = false }: LogoutButtonProps) {
  return (
    <button
      onClick={onLogout}
      disabled={isPending}
      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
      aria-label="Logout"
      title="Logout"
    >
      <LogOut className="size-3.5" />
      <span>Logout</span>
    </button>
  );
}
