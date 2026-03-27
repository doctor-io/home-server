import "server-only";

import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

const SYSTEMD_TIMER_PATH = "/etc/systemd/system/homeio-scheduled-reboot.timer";
const SYSTEMD_SERVICE_PATH = "/etc/systemd/system/homeio-scheduled-reboot.service";
const CONFIG_PATH = "/etc/homeio/power-schedule.json";

type ScheduledRebootFrequency = "daily" | "weekly";
type ScheduledRebootDayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type ScheduledRebootConfig = {
  enabled: boolean;
  frequency: ScheduledRebootFrequency;
  dayOfWeek: ScheduledRebootDayOfWeek;
  time: string;
};

const DEFAULT_SCHEDULE: ScheduledRebootConfig = {
  enabled: false,
  frequency: "weekly",
  dayOfWeek: "sunday",
  time: "03:00",
};

const DAY_TO_ON_CALENDAR: Record<ScheduledRebootDayOfWeek, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

function parseScheduleConfig(rawValue: string | null): ScheduledRebootConfig {
  if (!rawValue) return DEFAULT_SCHEDULE;

  try {
    const parsed = JSON.parse(rawValue) as Partial<ScheduledRebootConfig>;
    const enabled = typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_SCHEDULE.enabled;
    const frequency = parsed.frequency === "daily" || parsed.frequency === "weekly"
      ? parsed.frequency
      : DEFAULT_SCHEDULE.frequency;
    const dayOfWeek = parsed.dayOfWeek && parsed.dayOfWeek in DAY_TO_ON_CALENDAR
      ? parsed.dayOfWeek
      : DEFAULT_SCHEDULE.dayOfWeek;
    const time = typeof parsed.time === "string" && /^\d{2}:\d{2}$/.test(parsed.time)
      ? parsed.time
      : DEFAULT_SCHEDULE.time;

    return { enabled, frequency, dayOfWeek, time };
  } catch {
    return DEFAULT_SCHEDULE;
  }
}

function buildOnCalendar(config: ScheduledRebootConfig) {
  const [hour, minute] = config.time.split(":");
  if (!hour || !minute) {
    throw new Error("Scheduled reboot time must use HH:MM format");
  }

  if (config.frequency === "daily") {
    return `*-*-* ${hour}:${minute}:00`;
  }

  return `${DAY_TO_ON_CALENDAR[config.dayOfWeek]} *-*-* ${hour}:${minute}:00`;
}

function buildServiceFile() {
  return `[Unit]\nDescription=Homeio scheduled reboot\n\n[Service]\nType=oneshot\nExecStart=/usr/bin/systemctl reboot\n`;
}

function buildTimerFile(config: ScheduledRebootConfig) {
  return `[Unit]\nDescription=Homeio scheduled reboot timer\n\n[Timer]\nOnCalendar=${buildOnCalendar(config)}\nPersistent=true\nUnit=homeio-scheduled-reboot.service\n\n[Install]\nWantedBy=timers.target\n`;
}

async function runSystemctl(...args: string[]) {
  await execFileAsync("systemctl", args);
}

async function readStoredConfig() {
  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    return parseScheduleConfig(raw);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return DEFAULT_SCHEDULE;
    }
    throw error;
  }
}

export async function getScheduledRebootConfig(): Promise<ScheduledRebootConfig> {
  const stored = await readStoredConfig();

  try {
    const { stdout } = await execFileAsync("systemctl", ["is-enabled", "homeio-scheduled-reboot.timer"]);
    return {
      ...stored,
      enabled: stdout.trim() === "enabled",
    };
  } catch {
    return {
      ...stored,
      enabled: false,
    };
  }
}

export async function setScheduledRebootConfig(config: ScheduledRebootConfig) {
  if (!/^\d{2}:\d{2}$/.test(config.time)) {
    throw new Error("Scheduled reboot time must use HH:MM format");
  }

  await mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  if (!config.enabled) {
    await clearScheduledRebootConfig();
    await writeFile(CONFIG_PATH, `${JSON.stringify({ ...config, enabled: false }, null, 2)}\n`, "utf8");
    return;
  }

  await writeFile(SYSTEMD_SERVICE_PATH, buildServiceFile(), "utf8");
  await writeFile(SYSTEMD_TIMER_PATH, buildTimerFile(config), "utf8");
  await runSystemctl("daemon-reload");
  await runSystemctl("enable", "--now", "homeio-scheduled-reboot.timer");
}

export async function clearScheduledRebootConfig() {
  await execFileAsync("systemctl", ["disable", "--now", "homeio-scheduled-reboot.timer"]).catch(
    () => undefined,
  );
  await rm(SYSTEMD_TIMER_PATH, { force: true });
  await rm(SYSTEMD_SERVICE_PATH, { force: true });
  await runSystemctl("daemon-reload").catch(() => undefined);
}

export async function deleteScheduledRebootArtifacts() {
  await clearScheduledRebootConfig();
  await rm(CONFIG_PATH, { force: true }).catch(() => undefined);
}
