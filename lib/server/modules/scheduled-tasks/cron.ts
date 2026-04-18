/**
 * Minimal cron next-run calculator for 5-field cron expressions.
 * Supports: * (wildcard), single values, comma-separated lists.
 * Fields: minute hour day-of-month month day-of-week (0–6, Sunday=0)
 */

function parseCronField(field: string, min: number, max: number): Set<number> {
  const result = new Set<number>();
  if (field === "*") {
    for (let i = min; i <= max; i++) result.add(i);
    return result;
  }
  for (const part of field.split(",")) {
    const n = parseInt(part, 10);
    if (!isNaN(n) && n >= min && n <= max) result.add(n);
  }
  return result;
}

export function nextCronRun(expression: string, after: Date): Date | null {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minuteField, hourField, domField, monthField, dowField] = parts;

  const minutes = parseCronField(minuteField, 0, 59);
  const hours = parseCronField(hourField, 0, 23);
  const doms = parseCronField(domField, 1, 31);
  const months = parseCronField(monthField, 1, 12);
  const dows = parseCronField(dowField, 0, 6);

  const candidate = new Date(after);
  candidate.setSeconds(0);
  candidate.setMilliseconds(0);
  // Start searching from next minute
  candidate.setMinutes(candidate.getMinutes() + 1);

  // Search up to 1 year (525,600 minutes)
  const limit = 525_600;
  for (let i = 0; i < limit; i++) {
    const m = candidate.getMonth() + 1; // 1–12
    const dom = candidate.getDate();
    const dow = candidate.getDay(); // 0=Sun
    const h = candidate.getHours();
    const min = candidate.getMinutes();

    if (
      months.has(m) &&
      doms.has(dom) &&
      dows.has(dow) &&
      hours.has(h) &&
      minutes.has(min)
    ) {
      return new Date(candidate);
    }

    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  return null;
}
