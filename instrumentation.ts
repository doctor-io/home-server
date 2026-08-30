export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
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
