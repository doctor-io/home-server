import {
  proxy,
  resetAuthStatusCacheForTests,
  verifySessionTokenInMiddleware,
} from "@/proxy";
import { NextRequest } from "next/server";
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

function createToken(
  sessionId: string,
  expiresAtEpochSeconds: number,
  secret: string,
) {
  const payload = `${sessionId}.${expiresAtEpochSeconds}`;
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

describe("middleware auth guard", () => {
  const secret = "test-session-secret-123456";

  beforeEach(() => {
    vi.restoreAllMocks();
    resetAuthStatusCacheForTests();
  });

  it("verifies a valid token", async () => {
    const token = createToken(
      "session-1",
      Math.floor(Date.now() / 1000) + 3600,
      secret,
    );

    await expect(verifySessionTokenInMiddleware(token, secret)).resolves.toBe(
      true,
    );
  });

  it("redirects unauthenticated users to login", async () => {
    process.env.AUTH_SESSION_SECRET = secret;
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { hasUsers: true } }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    const request = new NextRequest("http://localhost/");
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("redirects unauthenticated users to register when no users exist", async () => {
    process.env.AUTH_SESSION_SECRET = secret;
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { hasUsers: false } }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    const request = new NextRequest("http://localhost/");
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/register");
  });

  it("allows authenticated users to root path", async () => {
    process.env.AUTH_SESSION_SECRET = secret;

    const token = createToken(
      "session-1",
      Math.floor(Date.now() / 1000) + 3600,
      secret,
    );

    const request = new NextRequest("http://localhost/", {
      headers: {
        cookie: `homeio_session=${token}`,
      },
    });

    const response = await proxy(request);

    expect(response.status).toBe(200);
  });

  it("returns auth entry hint for unauthenticated /api/auth/me when users exist", async () => {
    process.env.AUTH_SESSION_SECRET = secret;
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { hasUsers: true } }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    const request = new NextRequest("http://localhost/api/auth/me");
    const response = await proxy(request);

    expect(response.status).toBe(401);
    expect(response.headers.get("x-auth-entry")).toBe("/login");
  });

  it("returns auth entry hint for unauthenticated /api/auth/me when no users exist", async () => {
    process.env.AUTH_SESSION_SECRET = secret;
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { hasUsers: false } }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    const request = new NextRequest("http://localhost/api/auth/me");
    const response = await proxy(request);

    expect(response.status).toBe(401);
    expect(response.headers.get("x-auth-entry")).toBe("/register");
  });

  it("falls back to register when auth status lookup fails", async () => {
    process.env.AUTH_SESSION_SECRET = secret;
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("network failure"));

    const request = new NextRequest("http://localhost/");
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/register");
  });
});
