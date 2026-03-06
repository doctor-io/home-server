import { type NextRequest, NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { getStoreCatalogView } from "@/lib/server/modules/store/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "store.apps.list.get",
        requestId,
      },
      async () => {
        const searchParams = request.nextUrl.searchParams;
        const category = searchParams.get("category") ?? undefined;
        const search = searchParams.get("search") ?? undefined;
        const installedOnly = searchParams.get("installedOnly") === "true";
        const updatesOnly = searchParams.get("updatesOnly") === "true";

        const catalog = await getStoreCatalogView({
          category,
          search,
          installedOnly,
          updatesOnly,
        });

        return NextResponse.json(
          {
            data: catalog.apps,
            meta: {
              count: catalog.apps.length,
              categories: catalog.categories,
              featuredAppIds: catalog.featuredAppIds,
              recommendedAppIds: catalog.recommendedAppIds,
              sourcePath: catalog.sourcePath,
            },
          },
          {
            headers: {
              "Cache-Control": "no-store",
            },
          },
        );
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "store.apps.list.get.response",
      status: "error",
      requestId,
      message: "Unable to load store apps",
      error,
    });

    return NextResponse.json(
      {
        error: "Unable to load store apps",
      },
      { status: 500 },
    );
  }
}
