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
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { hasUsers: true } }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

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

  it("redirects stale authenticated users to register when no users exist", async () => {
    process.env.AUTH_SESSION_SECRET = secret;
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { hasUsers: false } }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

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

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/register");
    expect(response.cookies.get("homeio_session")?.value).toBe("");
  });

  it("allows recovery route access without redirecting authenticated users", async () => {
    process.env.AUTH_SESSION_SECRET = secret;

    const token = createToken(
      "session-1",
      Math.floor(Date.now() / 1000) + 3600,
      secret,
    );

    const request = new NextRequest("http://localhost/updating", {
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

  it("allows unauthenticated calls to the TOTP login route through", async () => {
    // Second leg of TOTP login: the caller has no session cookie yet, only a
    // short-lived partial-auth token. The proxy must NOT short-circuit with
    // a 401 — the route handler validates the token itself.
    process.env.AUTH_SESSION_SECRET = secret;

    const request = new NextRequest(
      "http://localhost/api/v1/auth/login/totp",
      { method: "POST" },
    );
    const response = await proxy(request);

    expect(response.status).toBe(200);
  });
});

describe("shared caching", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetAuthStatusCacheForTests();
    process.env.AUTH_SESSION_SECRET = "test-session-secret-123456";
  });

  function answerHasUsers() {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { hasUsers: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }

  it("forbids a proxy from storing a page", async () => {
    // A CDN told to cache everything served a six-day-old shell to every
    // visitor, referencing script hashes the next update had replaced. Homeio
    // ships an updater, so it cannot leave this to a proxy's defaults.
    answerHasUsers();

    const response = await proxy(new NextRequest("http://localhost/"));

    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("forbids it on the login page and on the pairing landing too", async () => {
    answerHasUsers();

    for (const path of ["/login", "/pair?code=abc"]) {
      const response = await proxy(new NextRequest(`http://localhost${path}`));
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    }
  });

  it("leaves static files cacheable, which is what a CDN is for", async () => {
    // They carry no session and change name when they change content.
    for (const path of ["/images/wallpaper.jpg", "/icon.svg", "/_next/chunk.js"]) {
      const response = await proxy(new NextRequest(`http://localhost${path}`));
      expect(response.headers.get("Cache-Control")).not.toBe("private, no-store");
    }
  });
});
