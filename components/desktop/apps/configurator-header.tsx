import { X } from "lucide-react";

import type { ConfiguratorView } from "@/components/desktop/apps/configurator-mapper";

type ConfiguratorHeaderProps = {
  title: string;
  activeView: ConfiguratorView;
  views: ConfiguratorView[];
  onViewChange: (view: ConfiguratorView) => void;
  onClose?: () => void;
};

function formatViewLabel(view: ConfiguratorView) {
  if (view === "classic") return "Classic";
  if (view === "compose") return "Docker Compose";
  return "Docker Run";
}

export function ConfiguratorHeader({
  title,
  activeView,
  views,
  onViewChange,
  onClose,
}: ConfiguratorHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-glass-border px-4 py-3">
      <div className="min-w-0">
        <h3 className="truncate text-lg font-semibold text-foreground">{title}</h3>
        <div className="mt-2 flex items-center gap-1.5">
          {views.map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => onViewChange(view)}
              className={`cursor-pointer rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                activeView === view
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-glass-border text-muted-foreground hover:bg-secondary/45 hover:text-foreground"
              }`}
            >
              {formatViewLabel(view)}
            </button>
          ))}
        </div>
      </div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-glass-border p-1.5 text-muted-foreground transition-colors hover:bg-secondary/45 hover:text-foreground"
          aria-label="Close configurator"
          title="Close"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </header>
  );
}
