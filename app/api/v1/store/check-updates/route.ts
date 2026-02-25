import { NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { checkAllAppsForUpdates } from "@/lib/server/modules/store/service";

export const runtime = "nodejs";

/**
 * POST /api/v1/store/check-updates
 *
 * Checks for updates for all installed apps by inspecting Docker images.
 * Updates the database with fresh update status.
 *
 * This should be called:
 * - When the user opens the Store
 * - Manually via a "Check for Updates" button
 * - Optionally in background every 6-12 hours
 */
export async function POST() {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "store.check-updates.post",
        requestId,
      },
      async () => {
        const results = await checkAllAppsForUpdates();

        const updatesAvailable = results.filter((r) => r.updateAvailable).length;

        logServerAction({
          level: "info",
          layer: "api",
          action: "store.check-updates.post.response",
          status: "success",
          requestId,
          message: `Checked ${results.length} apps, ${updatesAvailable} updates available`,
        });

        return NextResponse.json({
          data: results,
          meta: {
            totalApps: results.length,
            updatesAvailable,
          },
        });
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "store.check-updates.post.response",
      status: "error",
      requestId,
      message: "Failed to check for updates",
      error,
    });

    return NextResponse.json(
      {
        error: "Failed to check for updates",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }
}
