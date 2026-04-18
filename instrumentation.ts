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
  }
}
