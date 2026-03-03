"use client";

import { PopoverShell } from "@/components/desktop/status-bar/popover-shell";
import type { BatteryPopoverProps } from "@/components/desktop/status-bar/types";
import { safePercent } from "@/components/desktop/status-bar/utils";
import { BatteryCharging, BatteryFull } from "lucide-react";

function formatCapacityRatio(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return `${value.toFixed(1)}%`;
}

export function BatteryPopover({ battery, onClose }: BatteryPopoverProps) {
  const hasBattery = Boolean(battery?.hasBattery);
  const batteryPercent =
    typeof battery?.percent === "number" ? safePercent(battery.percent) : null;
  const isCharging = Boolean(battery?.isCharging);
  const acConnected = battery?.acConnected;
  const manufacturer = battery?.manufacturer ?? null;
  const cycleCount = battery?.cycleCount;
  const capacityRatio = formatCapacityRatio(
    battery?.designToMaxCapacityPercent,
  );
  const statusLabel = !hasBattery
    ? "No battery detected"
    : isCharging
      ? "Charging"
      : "On battery";

  return (
    <PopoverShell onClose={onClose} className="w-64">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-10 rounded-xl bg-status-green/15 flex items-center justify-center">
            {isCharging ? (
              <BatteryCharging className="size-5 text-status-green" />
            ) : (
              <BatteryFull className="size-5 text-status-amber" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Battery Status
            </p>
            <p className="text-xs text-muted-foreground">{statusLabel}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Charge Level</span>
              <span className="text-foreground font-medium">
                {batteryPercent === null ? "--" : `${batteryPercent}%`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  batteryPercent === null
                    ? "bg-muted-foreground/40"
                    : batteryPercent < 20
                      ? "bg-status-red"
                      : batteryPercent < 50
                        ? "bg-status-amber"
                        : "bg-status-green"
                }`}
                style={{ width: `${batteryPercent ?? 0}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                AC Power
              </span>
              <span className="text-sm font-medium text-foreground">
                {typeof acConnected === "boolean"
                  ? acConnected
                    ? "Connected"
                    : "Disconnected"
                  : "--"}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                Cycle Count
              </span>
              <span className="text-sm font-medium text-foreground">
                {typeof cycleCount === "number" ? cycleCount : "--"}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                Design / Max
              </span>
              <span className="text-sm font-medium text-foreground">
                {capacityRatio}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                Manufacturer
              </span>
              <span className="text-sm font-medium text-foreground">
                {manufacturer ?? "--"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </PopoverShell>
  );
}
