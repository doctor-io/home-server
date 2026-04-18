import "server-only";

import { getDueTasks, runScheduledTask } from "./service";

const POLL_INTERVAL_MS = 60_000;

let started = false;

export function startScheduledTaskRunner() {
  if (started) return;
  started = true;

  const tick = async () => {
    try {
      const dueTasks = await getDueTasks();
      for (const task of dueTasks) {
        runScheduledTask(task.id).catch(() => undefined);
      }
    } catch {
      // don't crash the runner
    }
  };

  // Run immediately on startup, then every minute
  tick();
  setInterval(tick, POLL_INTERVAL_MS);
}
