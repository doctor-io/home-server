import "server-only";

import { getDueTasks, runScheduledTask } from "./service";

const POLL_INTERVAL_MS = 60_000;
const MAX_CONCURRENT_TASKS = 3;

let started = false;

export function startScheduledTaskRunner() {
  if (started) return;
  started = true;

  const tick = async () => {
    try {
      const dueTasks = await getDueTasks();

      // Run at most MAX_CONCURRENT_TASKS tasks simultaneously
      for (let i = 0; i < dueTasks.length; i += MAX_CONCURRENT_TASKS) {
        const batch = dueTasks.slice(i, i + MAX_CONCURRENT_TASKS);
        await Promise.allSettled(batch.map((task) => runScheduledTask(task.id)));
      }
    } catch {
      // don't crash the runner
    }
  };

  // Run immediately on startup, then every minute
  tick();
  setInterval(tick, POLL_INTERVAL_MS);
}
