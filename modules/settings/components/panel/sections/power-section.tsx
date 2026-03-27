"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DAY_OF_WEEK_OPTIONS,
  SCHEDULE_TIME_OPTIONS,
  type ScheduledRebootInput,
  type SettingsBackend,
} from "@/modules/settings/components/panel/types";
import {
  InfoBanner,
  SectionDivider,
  SettingsSelect,
  Toggle,
} from "@/modules/settings/components/panel/controls";
import { SETTINGS_PANEL_INSET } from "@/modules/settings/components/panel/surface";
import { AlertTriangle, Loader2, Power, RefreshCw } from "@/components/icons/platform-icons";
import { useEffect, useState } from "react";

type PowerSectionProps = {
  power: SettingsBackend["power"];
  onRebootNow: () => Promise<void>;
  onShutdownNow: () => Promise<void>;
  onSaveScheduledReboot: (input: ScheduledRebootInput) => Promise<void>;
  onFactoryReset: () => Promise<void>;
};

export function PowerSection({
  power,
  onRebootNow,
  onShutdownNow,
  onSaveScheduledReboot,
  onFactoryReset,
}: PowerSectionProps) {
  const rebooting = power.reboot.isPending;
  const shuttingDown = power.shutdown.isPending;
  const resetting = power.factoryReset.isPending;
  const scheduledReboot = power.scheduledReboot;
  const [scheduleEnabled, setScheduleEnabled] = useState(
    scheduledReboot.enabled,
  );
  const [scheduleFrequency, setScheduleFrequency] = useState(
    scheduledReboot.frequency,
  );
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState(
    scheduledReboot.dayOfWeek,
  );
  const [scheduleTime, setScheduleTime] = useState(scheduledReboot.time);

  useEffect(() => {
    setScheduleEnabled(scheduledReboot.enabled);
    setScheduleFrequency(scheduledReboot.frequency);
    setScheduleDayOfWeek(scheduledReboot.dayOfWeek);
    setScheduleTime(scheduledReboot.time);
  }, [
    scheduledReboot.dayOfWeek,
    scheduledReboot.enabled,
    scheduledReboot.frequency,
    scheduledReboot.time,
  ]);

  const scheduleDirty =
    scheduleEnabled !== scheduledReboot.enabled ||
    scheduleFrequency !== scheduledReboot.frequency ||
    scheduleDayOfWeek !== scheduledReboot.dayOfWeek ||
    scheduleTime !== scheduledReboot.time;

  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="Power Management" />
      <InfoBanner
        text="These actions will affect all running services. Make sure to save your work before proceeding."
        variant="warning"
      />
      {power.reboot.error ? (
        <InfoBanner text={power.reboot.error} variant="warning" />
      ) : null}
      {power.shutdown.error ? (
        <InfoBanner text={power.shutdown.error} variant="warning" />
      ) : null}
      {power.factoryReset.error ? (
        <InfoBanner text={power.factoryReset.error} variant="warning" />
      ) : null}
      {scheduledReboot.error ? (
        <InfoBanner text={scheduledReboot.error} variant="warning" />
      ) : null}

      <div className="grid grid-cols-2 gap-3 py-3">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              className={`group flex cursor-pointer flex-col items-center gap-2 p-4 transition-colors hover:bg-background/70 disabled:cursor-not-allowed disabled:opacity-60 ${SETTINGS_PANEL_INSET}`}
              disabled={rebooting || !power.reboot.available}
            >
              <RefreshCw className="size-5 text-status-amber group-hover:animate-spin" />
              <span className="text-xs text-foreground">Reboot</span>
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reboot server?</AlertDialogTitle>
              <AlertDialogDescription>
                All running Docker containers and services will be temporarily
                stopped and restarted. This takes about 30–60 seconds.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-status-amber text-white hover:bg-status-amber/90"
                onClick={() => {
                  void onRebootNow();
                }}
                disabled={rebooting}
              >
                {rebooting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Scheduling reboot...
                  </>
                ) : (
                  "Reboot now"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              className={`group flex cursor-pointer flex-col items-center gap-2 p-4 transition-colors hover:bg-background/70 disabled:cursor-not-allowed disabled:opacity-60 ${SETTINGS_PANEL_INSET}`}
              disabled={shuttingDown || !power.shutdown.available}
            >
              <Power className="size-5 text-status-red" />
              <span className="text-xs text-foreground">Shutdown</span>
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Shut down server?</AlertDialogTitle>
              <AlertDialogDescription>
                This powers the machine off completely. You will need to start
                it again manually before Homeio becomes available.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => {
                  void onShutdownNow();
                }}
                disabled={shuttingDown}
              >
                {shuttingDown ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Scheduling shutdown...
                  </>
                ) : (
                  "Shutdown now"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <SectionDivider title="Schedule" />
      <Toggle
        label="Scheduled reboot"
        description="Automatically reboot the server on a set schedule"
        enabled={scheduleEnabled}
        onToggle={() => setScheduleEnabled((current) => !current)}
        disabled={scheduledReboot.isLoading || scheduledReboot.isPending}
      />
      <SettingsSelect
        label="Frequency"
        value={scheduleFrequency}
        options={["daily", "weekly"]}
        description="Choose whether reboot runs every day or once a week"
        disabled={
          !scheduleEnabled ||
          scheduledReboot.isLoading ||
          scheduledReboot.isPending
        }
        onChange={(value) => setScheduleFrequency(value as "daily" | "weekly")}
      />
      {scheduleFrequency === "weekly" ? (
        <SettingsSelect
          label="Day"
          value={scheduleDayOfWeek}
          options={DAY_OF_WEEK_OPTIONS}
          description="Day of the week when the reboot should run"
          disabled={
            !scheduleEnabled ||
            scheduledReboot.isLoading ||
            scheduledReboot.isPending
          }
          onChange={(value) =>
            setScheduleDayOfWeek(value as ScheduledRebootInput["dayOfWeek"])
          }
        />
      ) : null}
      <SettingsSelect
        label="Time"
        value={scheduleTime}
        options={SCHEDULE_TIME_OPTIONS}
        description="Server local time used for the scheduled reboot"
        disabled={
          !scheduleEnabled ||
          scheduledReboot.isLoading ||
          scheduledReboot.isPending
        }
        onChange={(value) => setScheduleTime(value)}
      />
      <div className="flex items-center gap-3 py-2">
        <button
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={
            !scheduleDirty ||
            scheduledReboot.isLoading ||
            scheduledReboot.isPending
          }
          onClick={() => {
            void onSaveScheduledReboot({
              enabled: scheduleEnabled,
              frequency: scheduleFrequency,
              dayOfWeek: scheduleDayOfWeek,
              time: scheduleTime,
            });
          }}
        >
          {scheduledReboot.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving schedule...
            </>
          ) : (
            "Save scheduled reboot"
          )}
        </button>
        <span className="text-xs text-muted-foreground">
          {scheduleEnabled
            ? `Reboot will run ${scheduleFrequency === "daily" ? "daily" : `every ${scheduleDayOfWeek}`} at ${scheduleTime}.`
            : "Scheduled reboot is disabled."}
        </span>
      </div>

      <SectionDivider title="Factory Reset" />
      <InfoBanner
        text="Factory reset will stop all containers, remove Docker images, custom networks, and volumes, reset the database, delete everything under /DATA, recreate the default directories, and then reboot the machine."
        variant="warning"
      />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            className="mt-2 inline-flex cursor-pointer items-center gap-2 self-start rounded-lg bg-destructive px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={resetting || !power.factoryReset.available}
          >
            <AlertTriangle className="size-4" />
            Factory Reset Server
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Factory reset server?</AlertDialogTitle>
            <AlertDialogDescription>
              This is destructive. Homeio will remove Docker containers, images,
              volumes, custom networks, reset the database, wipe /DATA, recreate
              a clean data root, and reboot. After reset, you will need to
              register a new user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                void onFactoryReset();
              }}
              disabled={resetting}
            >
              {resetting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Scheduling factory reset...
                </>
              ) : (
                "Factory reset"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
