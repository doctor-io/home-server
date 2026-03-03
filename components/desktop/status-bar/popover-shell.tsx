"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type PopoverShellProps = {
  onClose: () => void;
  className?: string;
  children: ReactNode;
};

export function PopoverShell({ onClose, className, children }: PopoverShellProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={cn(
        "absolute top-full right-0 mt-2 bg-popover backdrop-blur-2xl border border-glass-border rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-[200]",
        className,
      )}
    >
      {children}
    </div>
  );
}
