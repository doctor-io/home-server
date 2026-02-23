import { beforeEach, describe, expect, it, vi } from "vitest";
import type { POST as LoginRoutePost } from "@/app/api/auth/login/route";

type LoadedRoute = {
  POST: typeof LoginRoutePost;
  loginUser: ReturnType<typeof vi.fn>;
  AuthError: new (message: string, statusCode: number) => Error & {
    statusCode: number;
  };
};

async function loadRouteWithSecureCookie(secure: boolean): Promise<LoadedRoute> {
  vi.resetModules();

  vi.doMock("@/lib/server/env", () => ({
    serverEnv: {
      AUTH_COOKIE_SECURE: secure,
    },
  }));

  vi.doMock("@/lib/server/modules/auth/service", () => {
    class AuthError extends Error {
      constructor(
        message: string,
        public readonly statusCode: number,
      ) {
        super(message);
      }
    }

    return {
      AuthError,
      loginUser: vi.fn(),
    };
  });

  const routeModule = await import("@/app/api/auth/login/route");
  const serviceModule = await import("@/lib/server/modules/auth/service");

  return {
    POST: routeModule.POST,
    loginUser: vi.mocked(serviceModule.loginUser),
    AuthError: serviceModule.AuthError,
  };
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("sets a non-secure session cookie when AUTH_COOKIE_SECURE=false", async () => {
    const { POST, loginUser } = await loadRouteWithSecureCookie(false);

    loginUser.mockResolvedValueOnce({
      token: "session-token",
      expiresAt: new Date(Date.now() + 3600_000),
      user: {
        id: "u1",
        username: "admin",
      },
    });

    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "StrongPass123" }),
    });

    const response = await POST(request);
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(cookie).toContain("homeio_session=");
    expect(cookie).not.toContain("Secure");
  });

  it("sets a secure session cookie when AUTH_COOKIE_SECURE=true", async () => {
    const { POST, loginUser } = await loadRouteWithSecureCookie(true);

    loginUser.mockResolvedValueOnce({
      token: "session-token",
      expiresAt: new Date(Date.now() + 3600_000),
      user: {
        id: "u1",
        username: "admin",
      },
    });

    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "StrongPass123" }),
    });

    const response = await POST(request);
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(cookie).toContain("homeio_session=");
    expect(cookie).toContain("Secure");
  });

  it("returns 401 on invalid credentials", async () => {
    const { POST, loginUser, AuthError } = await loadRouteWithSecureCookie(
      false,
    );

    loginUser.mockRejectedValueOnce(
      new AuthError("Invalid username or password", 401),
    );

    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "bad-pass" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });
});
