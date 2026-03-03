"use client";

import { Calendar } from "@/components/ui/calendar";
import { PopoverShell } from "@/components/desktop/status-bar/popover-shell";

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
  return (
    <PopoverShell onClose={onClose} className="w-72">
      <div className="px-3 py-2 border-b border-glass-border">
        <p className="text-sm font-semibold text-foreground">Date Picker</p>
        <p className="text-xs text-muted-foreground">
          {selectedDate.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={(date) => {
          if (date) onSelectDate(date);
        }}
        className="p-2"
      />
    </PopoverShell>
  );
}
