const ANSI = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function canUseColor() {
  if (process.env.NO_COLOR === "1" || process.env.NO_COLOR === "true") return false;
  return Boolean(process.stdout?.isTTY);
}

function colorize(text, color) {
  if (!canUseColor()) return text;
  return `${color}${text}${ANSI.reset}`;
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return '"[unserializable]"';
  }
}

function statusGlyph(entry) {
  if (entry.status === "success") return colorize("✓", ANSI.green);
  if (entry.status === "error" || entry.level === "error") return colorize("x", ANSI.red);
  if (entry.level === "warn") return colorize("!", ANSI.yellow);
  if (entry.status === "start") return colorize(">", ANSI.cyan);
  return colorize("•", ANSI.gray);
}

function formatConsoleLine(entry) {
  const duration = typeof entry.durationMs === "number" ? ` ${entry.durationMs}ms` : "";
  const request = entry.requestId ? ` req=${entry.requestId}` : "";
  const message = entry.message ? ` msg=${entry.message}` : "";
  const meta = entry.meta ? ` meta=${safeStringify(entry.meta)}` : "";
  const error = entry.error?.message ? ` err=${entry.error.message}` : "";
  return `${statusGlyph(entry)} ${entry.timestamp} ${entry.layer}.${entry.action} ${entry.status.toUpperCase()}${duration}${request}${message}${meta}${error}`;
}

function log(payload) {
  const entry = {
    timestamp: new Date().toISOString(),
    runtime: "server",
    level: payload.level ?? "info",
    layer: "system",
    action: payload.action,
    status: payload.status ?? "info",
    durationMs: payload.durationMs,
    requestId: payload.requestId,
    message: payload.message,
    meta: payload.meta,
    error:
      payload.error instanceof Error
        ? {
            name: payload.error.name,
            message: payload.error.message,
            stack: payload.error.stack,
          }
        : undefined,
  };

  const line = formatConsoleLine(entry);

  if (entry.level === "error") {
    console.error(line);
    return;
  }

  if (entry.level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export { log };
