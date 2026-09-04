import "server-only";

import type { ApiSession } from "@/lib/server/modules/auth/api";
import type { ApiTokenScope } from "@/lib/shared/contracts/api-tokens";
import type { Entitlement } from "@/lib/shared/contracts/licensing";

/**
 * Where API routes that do not ship in this repo plug in.
 *
 * Next.js routing is file-based, so an optional module cannot add an endpoint
 * without committing a file here. Everything registered below is served under
 * /api/v1/ext/ by a single catch-all route instead, which keeps the core's
 * route tree closed while leaving one deliberate opening.
 *
 * Registration happens once at boot, from the extensions loader.
 */

export const EXTENSION_ROUTE_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
] as const;

export type ExtensionRouteMethod = (typeof EXTENSION_ROUTE_METHODS)[number];

export type ExtensionRouteContext = {
  /** Path segments after /api/v1/ext/, already URL-decoded by Next. */
  path: string[];
  session: ApiSession;
  /** Correlates this call with the surrounding api.ext log lines. */
  requestId: string;
};

export type ExtensionRouteHandler = (
  request: Request,
  context: ExtensionRouteContext,
) => Response | Promise<Response>;

export type ExtensionRoute = {
  method: ExtensionRouteMethod;
  /** Path under /api/v1/ext/, e.g. "backup/schedules". No leading slash. */
  path: string;
  /**
   * Token scope this route accepts. Omitted means session cookies only —
   * requireApiSession refuses bearer tokens for a route that names no scope.
   */
  scope?: ApiTokenScope;
  /**
   * Entitlement this route needs. Enforced by the core dispatcher, not by the
   * module: a paid endpoint must not be the one deciding whether it was paid
   * for.
   */
  entitlement?: Entitlement;
  handler: ExtensionRouteHandler;
};

const routes = new Map<string, ExtensionRoute>();

/** "a//b/" and ["a","b"] both become "a/b", so lookups cannot miss on slashes. */
export function normalizeExtensionPath(path: string | string[]): string {
  const segments = Array.isArray(path) ? path : [path];

  return segments
    .flatMap((segment) => segment.split("/"))
    .filter((segment) => segment.length > 0)
    .join("/");
}

function keyOf(method: ExtensionRouteMethod, path: string | string[]) {
  return `${method} ${normalizeExtensionPath(path)}`;
}

/**
 * Registers routes, rejecting anything malformed at boot rather than serving
 * it. A duplicate throws: two modules silently shadowing each other is the
 * failure mode that would be hardest to diagnose once modules ship separately.
 */
export function registerExtensionRoutes(newRoutes: ExtensionRoute[]): void {
  for (const route of newRoutes) {
    if (!EXTENSION_ROUTE_METHODS.includes(route.method)) {
      throw new Error(`Unsupported extension route method: ${route.method}`);
    }

    const path = normalizeExtensionPath(route.path);
    if (!path) {
      throw new Error("An extension route needs a non-empty path");
    }
    if (path.split("/").some((segment) => segment === "." || segment === "..")) {
      throw new Error(`Extension route path may not traverse: ${route.path}`);
    }

    const key = keyOf(route.method, path);
    if (routes.has(key)) {
      throw new Error(`Extension route already registered: ${key}`);
    }

    routes.set(key, { ...route, path });
  }
}

export function findExtensionRoute(
  method: ExtensionRouteMethod,
  path: string | string[],
): ExtensionRoute | undefined {
  return routes.get(keyOf(method, path));
}

export function listExtensionRoutes(): ExtensionRoute[] {
  return [...routes.values()];
}

/** Test-only: the registry is process-wide and boot-time in production. */
export function resetExtensionRoutes(): void {
  routes.clear();
}
