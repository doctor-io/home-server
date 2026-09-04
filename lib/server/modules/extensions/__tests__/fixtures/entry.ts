import { registerExtensionRoutes } from "@/lib/server/modules/extensions/route-registry";

/** Stands in for an out-of-repo extensions bundle in the loader's tests. */
export function register() {
  registerExtensionRoutes([
    {
      method: "GET",
      path: "fixture/ping",
      handler: () => new Response(null, { status: 204 }),
    },
  ]);
}
