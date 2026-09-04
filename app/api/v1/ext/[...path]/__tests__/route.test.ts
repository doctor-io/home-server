import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE, GET, POST } from "@/app/api/v1/ext/[...path]/route";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import {
  registerExtensionRoutes,
  resetExtensionRoutes,
} from "@/lib/server/modules/extensions/route-registry";

function contextFor(...path: string[]) {
  return { params: Promise.resolve({ path }) };
}

function requestFor(path: string, method = "GET") {
  return new Request(`http://localhost/api/v1/ext/${path}`, { method });
}

describe("/api/v1/ext/**", () => {
  beforeEach(() => {
    resetExtensionRoutes();
  });

  it("returns 404 when nothing is registered", async () => {
    const response = await GET(
      requestFor("backup/schedules"),
      contextFor("backup", "schedules"),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      code: "extension_route_not_found",
    });
  });

  it("dispatches to the registered handler", async () => {
    registerExtensionRoutes([
      {
        method: "GET",
        path: "backup/schedules",
        handler: (_request, context) =>
          NextResponse.json({ data: context.path }),
      },
    ]);

    const response = await GET(
      requestFor("backup/schedules"),
      contextFor("backup", "schedules"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: ["backup", "schedules"] });
  });

  it("routes each method to its own handler", async () => {
    registerExtensionRoutes([
      { method: "POST", path: "reports", handler: () => NextResponse.json({ via: "post" }) },
      { method: "DELETE", path: "reports", handler: () => NextResponse.json({ via: "delete" }) },
    ]);

    const posted = await POST(requestFor("reports", "POST"), contextFor("reports"));
    const deleted = await DELETE(requestFor("reports", "DELETE"), contextFor("reports"));

    expect(await posted.json()).toEqual({ via: "post" });
    expect(await deleted.json()).toEqual({ via: "delete" });
  });

  it("rejects an unauthenticated caller before saying whether a route exists", async () => {
    vi.mocked(requireApiSession).mockResolvedValueOnce({
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET(
      requestFor("does/not/exist"),
      contextFor("does", "not", "exist"),
    );

    expect(response.status).toBe(401);
  });

  it("asks for the route's token scope", async () => {
    registerExtensionRoutes([
      {
        method: "GET",
        path: "metrics",
        scope: "read:metrics",
        handler: () => NextResponse.json({ ok: true }),
      },
    ]);

    await GET(requestFor("metrics"), contextFor("metrics"));

    expect(vi.mocked(requireApiSession)).toHaveBeenCalledWith(
      expect.anything(),
      { scope: "read:metrics" },
    );
  });

  it("turns a throwing handler into a 500 without leaking its message", async () => {
    registerExtensionRoutes([
      {
        method: "GET",
        path: "boom",
        handler: () => {
          throw new Error("secret internal detail");
        },
      },
    ]);

    const response = await GET(requestFor("boom"), contextFor("boom"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe("Extension route failed");
    expect(JSON.stringify(body)).not.toContain("secret internal detail");
  });
});
