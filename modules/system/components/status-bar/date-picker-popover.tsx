"use client";

import { Calendar } from "@/components/ui/calendar";
import { PopoverShell } from "@/modules/system/components/status-bar/popover-shell";

type DatePickerPopoverProps = {
  onClose: () => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
};

export function DatePickerPopover({
  onClose,
  selectedDate,
  onSelectDate,
}: DatePickerPopoverProps) {
  const today = new Date();
  const isToday =
    selectedDate.getFullYear() === today.getFullYear() &&
    selectedDate.getMonth() === today.getMonth() &&
    selectedDate.getDate() === today.getDate();

  return (
    <PopoverShell
      onClose={onClose}
      className="w-[20rem] overflow-hidden rounded-[calc(var(--radius)+0.5rem)] border-border/70 bg-popover/96 p-0 shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-3xl"
    >
      <div className="border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.015))] px-4 py-3 shadow-inner shadow-black/10">
        <div className="mb-3 flex items-start justify-between gap-3 border-b border-border/50 pb-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
              Calendar
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {selectedDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <span className="rounded-full border border-border/60 bg-background/65 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/85">
            {isToday ? "Today" : selectedDate.toLocaleDateString("en-US", { year: "numeric" })}
          </span>
        </div>
        <Calendar
          mode="single"
          navLayout="around"
          selected={selectedDate}
          onSelect={(date) => {
            if (date) onSelectDate(date);
          }}
          className="w-full bg-transparent p-0"
          formatters={{
            formatWeekdayName: (date) =>
              date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2),
          }}
          classNames={{
            root: "w-full",
            months: "w-full",
            month: "grid w-full grid-cols-[2rem_minmax(0,1fr)_2rem] items-center gap-x-2 gap-y-3",
            nav: "hidden",
            button_previous:
              "col-start-1 row-start-1 flex size-8 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/55 text-muted-foreground shadow-sm transition-colors hover:bg-secondary/75 hover:text-foreground",
            button_next:
              "col-start-3 row-start-1 flex size-8 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/55 text-muted-foreground shadow-sm transition-colors hover:bg-secondary/75 hover:text-foreground",
            month_caption:
              "col-start-2 row-start-1 mb-0 flex h-8 items-center justify-center",
            caption_label:
              "flex items-center justify-center text-center text-base font-semibold tracking-tight text-foreground",
            month_grid: "col-span-3 w-full border-separate border-spacing-y-1",
            weekdays: "mb-1 grid grid-cols-7 gap-1",
            weekday:
              "flex h-7 items-center justify-center text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/75",
            week: "mt-1 grid grid-cols-7 gap-1",
            day: "aspect-square p-0",
            day_button:
              "size-9 rounded-xl border border-transparent text-sm font-medium text-foreground transition-colors hover:border-border/70 hover:bg-secondary/55 aria-selected:border-primary/30",
            outside:
              "text-muted-foreground/35 aria-selected:text-muted-foreground/40",
            today:
              "bg-secondary/70 text-foreground rounded-xl",
          }}
        />
      </div>
    </PopoverShell>
  );
}
