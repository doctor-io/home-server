"use client";

import { Bell, Trash2, CheckCircle2 } from "@/components/icons/platform-icons";
import { useNotifications } from "@/modules/system/hooks/useNotifications";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

const KIND_DOT: Record<string, string> = {
  error: "bg-status-red",
  success: "bg-status-green",
  info: "bg-primary",
};

type Filter = "all" | "unread";

export function NotificationsPanel() {
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications();
  const [filter, setFilter] = useState<Filter>("all");

  const visible = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  return (
    <div className="flex h-full flex-col bg-background/60">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-glass-border/60 px-4 py-3">
        <div className="flex items-center gap-1 rounded-lg border border-glass-border/60 bg-background/40 p-0.5">
          {(["all", "unread"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                filter === f
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f}
              {f === "unread" && unreadCount > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-3xs text-primary">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => markAllRead()}
            disabled={unreadCount === 0}
            title="Mark all read"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="size-3.5" />
            Mark all read
          </button>
          <button
            onClick={() => clearAll()}
            disabled={notifications.length === 0}
            title="Clear all"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-background/50 hover:text-status-red disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="size-3.5" />
            Clear all
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
            <Bell className="size-10 opacity-20" />
            <p className="text-sm">
              {filter === "unread" ? "No unread notifications" : "No notifications"}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-glass-border/40">
            {visible.map((n) => (
              <li
                key={n.id}
                className={cn(
                  "flex items-start gap-3 px-5 py-4 transition-colors hover:bg-background/30",
                  !n.read && "bg-primary/5",
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    n.read ? "bg-muted-foreground/20" : (KIND_DOT[n.kind] ?? "bg-primary"),
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={cn("text-sm font-medium", n.read ? "text-muted-foreground" : "text-foreground")}>
                      {n.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground/60">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
