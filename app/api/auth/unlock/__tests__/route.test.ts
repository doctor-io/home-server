import { NextRequest } from "next/server";
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
    verifyUnlockPassword: vi.fn(),
  };
});

import { POST } from "@/app/api/auth/unlock/route";
import { AuthError, verifyUnlockPassword } from "@/lib/server/modules/auth/service";

describe("POST /api/auth/unlock", () => {
  it("unlocks session when password is valid", async () => {
    vi.mocked(verifyUnlockPassword).mockResolvedValueOnce({
      userId: "u1",
      username: "admin",
    });

    const request = new NextRequest("http://localhost/api/auth/unlock", {
      method: "POST",
      headers: {
        cookie: "homeio_session=session-token",
      },
      body: JSON.stringify({ password: "StrongPass123" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
  });

  it("returns auth error when password is invalid", async () => {
    vi.mocked(verifyUnlockPassword).mockRejectedValueOnce(
      new AuthError("Invalid password", 401),
    );

    const request = new NextRequest("http://localhost/api/auth/unlock", {
      method: "POST",
      headers: {
        cookie: "homeio_session=session-token",
      },
      body: JSON.stringify({ password: "bad-pass" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });
});
