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

  if (entry.level === "error") {
    console.error(JSON.stringify(entry));
    return;
  }

  if (entry.level === "warn") {
    console.warn(JSON.stringify(entry));
    return;
  }

  console.log(JSON.stringify(entry));
}

export { log };
