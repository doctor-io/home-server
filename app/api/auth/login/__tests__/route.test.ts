import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/auth/service", () => {
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

import { POST } from "@/app/api/auth/login/route";
import { AuthError, loginUser } from "@/lib/server/modules/auth/service";

describe("POST /api/auth/login", () => {
  it("sets session cookie on successful login", async () => {
    vi.mocked(loginUser).mockResolvedValueOnce({
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

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("homeio_session=");
  });

  it("returns 401 on invalid credentials", async () => {
    vi.mocked(loginUser).mockRejectedValueOnce(
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
