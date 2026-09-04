import { NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import {
  findExtensionRoute,
  normalizeExtensionPath,
  type ExtensionRouteMethod,
} from "@/lib/server/modules/extensions/route-registry";
import { hasEntitlement } from "@/lib/server/modules/licensing/entitlements-service";

export const runtime = "nodejs";

type Context = {
  params: Promise<{
    path: string[];
  }>;
};

/**
 * /api/v1/ext/**
 *
 * The one opening in the core's route tree: every request here is dispatched
 * to the extension route registry. Nothing registers in this repo, so an
 * install without optional modules answers 404 to all of it.
 */
async function handleExtensionRequest(
  request: Request,
  context: Context,
  method: ExtensionRouteMethod,
) {
  const { path } = await context.params;
  const segments = path ?? [];
  const route = findExtensionRoute(method, segments);

  // Authenticated before answering, including when no route matched: replying
  // 404 to an anonymous caller would let them map which extension routes exist.
  const apiSession = await requireApiSession(
    request,
    route?.scope ? { scope: route.scope } : undefined,
  );
  if (apiSession.response) return apiSession.response;

  const normalizedPath = normalizeExtensionPath(segments);

  if (!route) {
    return NextResponse.json(
      {
        error: `No extension route for ${method} /${normalizedPath}`,
        code: "extension_route_not_found",
      },
      { status: 404 },
    );
  }

  // Enforced here rather than inside the handler: the module that benefits from
  // an entitlement is not the right place to check for it.
  if (route.entitlement && !hasEntitlement(route.entitlement)) {
    return NextResponse.json(
      {
        error: `This endpoint requires the ${route.entitlement} entitlement`,
        code: "entitlement_required",
        entitlement: route.entitlement,
      },
      { status: 403 },
    );
  }

  const requestId = createRequestId();

  return withServerTiming(
    {
      layer: "api",
      action: "ext.dispatch",
      requestId,
      meta: { method, path: normalizedPath },
    },
    async () => {
      try {
        return await route.handler(request, {
          path: segments,
          session: apiSession.session,
          requestId,
        });
      } catch (error) {
        // An optional module's bug must not take the request down with an
        // unhandled rejection, and its message must not reach the client.
        logServerAction({
          level: "error",
          layer: "api",
          action: "ext.dispatch",
          status: "error",
          requestId,
          meta: {
            method,
            path: normalizedPath,
            error: error instanceof Error ? error.message : String(error),
          },
        });

        return NextResponse.json(
          { error: "Extension route failed", code: "extension_route_failed" },
          { status: 500 },
        );
      }
    },
  );
}

export async function GET(request: Request, context: Context) {
  return handleExtensionRequest(request, context, "GET");
}

export async function POST(request: Request, context: Context) {
  return handleExtensionRequest(request, context, "POST");
}

export async function PUT(request: Request, context: Context) {
  return handleExtensionRequest(request, context, "PUT");
}

export async function PATCH(request: Request, context: Context) {
  return handleExtensionRequest(request, context, "PATCH");
}

export async function DELETE(request: Request, context: Context) {
  return handleExtensionRequest(request, context, "DELETE");
}
