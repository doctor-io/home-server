export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // First, so an extension's routes are registered before the server takes
    // its first request. No-op unless HOMEIO_EXTENSIONS_ENTRY is set.
    const { loadExtensions } = await import(
      "@/lib/server/modules/extensions/loader"
    );
    await loadExtensions();

    const { startScheduledTaskRunner } = await import(
      "@/lib/server/modules/scheduled-tasks/runner"
    );
    startScheduledTaskRunner();

    const { startUsbPoller } = await import(
      "@/lib/server/modules/files/usb-storage"
    );
    startUsbPoller();

    // No-op unless HOMEIO_AUTOHEAL is true — the service checks the flag and
    // logs which way it went, so a server that is not healing says so.
    const { startAppHealthService } = await import(
      "@/lib/server/modules/apps/health-service"
    );
    startAppHealthService();
  }
}
