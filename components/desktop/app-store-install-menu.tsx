"use client";

import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type AppStoreInstallMenuProps = {
  onInstallCustomClick: () => void;
};

export function AppStoreInstallMenu({ onInstallCustomClick }: AppStoreInstallMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function onDocumentPointerDown(event: MouseEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (!root.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocumentPointerDown);
    return () => {
      document.removeEventListener("mousedown", onDocumentPointerDown);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-label="Install menu"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/15 text-primary rounded-md hover:bg-primary/25 transition-colors cursor-pointer"
      >
        <Plus className="size-3.5" />
        Install
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.4rem)] min-w-44 rounded-lg border border-glass-border bg-popover/95 shadow-xl p-1 z-30"
        >
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setIsOpen(false);
              onInstallCustomClick();
            }}
            className="w-full text-left px-2.5 py-1.5 text-xs text-foreground hover:bg-secondary/50 rounded-md transition-colors cursor-pointer"
          >
            Install Custom App
          </button>
        </div>
      ) : null}
    </div>
  );
}
