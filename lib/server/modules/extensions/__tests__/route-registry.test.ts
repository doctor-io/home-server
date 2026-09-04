import { beforeEach, describe, expect, it } from "vitest";

import {
  findExtensionRoute,
  listExtensionRoutes,
  normalizeExtensionPath,
  registerExtensionRoutes,
  resetExtensionRoutes,
} from "@/lib/server/modules/extensions/route-registry";

const handler = () => new Response(null, { status: 204 });

describe("extension route registry", () => {
  beforeEach(() => {
    resetExtensionRoutes();
  });

  it("finds a registered route by method and path", () => {
    registerExtensionRoutes([
      { method: "GET", path: "backup/schedules", handler },
    ]);

    expect(findExtensionRoute("GET", ["backup", "schedules"])?.handler).toBe(
      handler,
    );
  });

  it("does not match another method on the same path", () => {
    registerExtensionRoutes([
      { method: "GET", path: "backup/schedules", handler },
    ]);

    expect(findExtensionRoute("POST", ["backup", "schedules"])).toBeUndefined();
  });

  it("normalizes stray and repeated slashes", () => {
    expect(normalizeExtensionPath("/backup//schedules/")).toBe(
      "backup/schedules",
    );
    expect(normalizeExtensionPath(["backup", "schedules"])).toBe(
      "backup/schedules",
    );

    registerExtensionRoutes([
      { method: "GET", path: "/backup//schedules/", handler },
    ]);

    expect(findExtensionRoute("GET", "backup/schedules")).toBeDefined();
  });

  it("refuses a duplicate registration rather than shadowing it", () => {
    registerExtensionRoutes([{ method: "GET", path: "reports", handler }]);

    expect(() =>
      registerExtensionRoutes([{ method: "GET", path: "reports", handler }]),
    ).toThrow(/already registered/);
  });

  it("refuses an empty path", () => {
    expect(() =>
      registerExtensionRoutes([{ method: "GET", path: "//", handler }]),
    ).toThrow(/non-empty path/);
  });

  it("refuses a traversing path", () => {
    expect(() =>
      registerExtensionRoutes([
        { method: "GET", path: "backup/../../etc", handler },
      ]),
    ).toThrow(/may not traverse/);
  });

  it("registers nothing by default", () => {
    expect(listExtensionRoutes()).toEqual([]);
  });
})
