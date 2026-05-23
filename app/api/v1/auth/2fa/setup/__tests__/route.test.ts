import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/auth/totp-service", () => ({
  TotpServiceError: class TotpServiceError extends Error {
    code: string;
    statusCode: number;

    constructor(
      message: string,
      options: { code: string; statusCode: number },
    ) {
      super(message);
      this.name = "TotpServiceError";
      this.code = options.code;
      this.statusCode = options.statusCode;
    }
  },
  beginTotpEnrollment: vi.fn(),
}));

import { POST } from "@/app/api/v1/auth/2fa/setup/route";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import {
  TotpServiceError,
  beginTotpEnrollment,
} from "@/lib/server/modules/auth/totp-service";

const buildRequest = () =>
  new Request("http://localhost/api/v1/auth/2fa/setup", { method: "POST" });

beforeEach(() => {
  vi.mocked(beginTotpEnrollment).mockReset();
  // Default to the authenticated-session shape from test/setup.ts so
  // individual tests only need to override when explicitly testing 401s.
  vi.mocked(requireApiSession).mockImplementation(async () => ({
    session: {
      sessionId: "test-session",
      userId: "test-user",
      username: "admin",
      passwordHash: "test-password-hash",
      expiresAt: new Date(Date.now() + 3600_000),
    },
    response: null,
  }));
});

describe("POST /api/v1/auth/2fa/setup", () => {
  it("returns 401 when the session cannot be authenticated", async () => {
    vi.mocked(requireApiSession).mockResolvedValueOnce({
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await POST(buildRequest());
    expect(response.status).toBe(401);
    expect(vi.mocked(beginTotpEnrollment)).not.toHaveBeenCalled();
  });

  it("returns 200 with secret + otpauth URL + inline SVG on fresh enrolment", async () => {
    vi.mocked(beginTotpEnrollment).mockResolvedValueOnce({
      secret: "JBSWY3DPEHPK3PXP",
      otpAuthUrl: "otpauth://totp/Homeio%3Aadmin?secret=JBSWY3DPEHPK3PXP",
      qrCodeSvg: '<svg xmlns="http://www.w3.org/2000/svg">…</svg>',
    });

    const response = await POST(buildRequest());
    expect(response.status).toBe(200);

    const json = (await response.json()) as {
      data: { secret: string; otpAuthUrl: string; qrCodeSvg: string };
    };
    expect(json.data.secret).toBe("JBSWY3DPEHPK3PXP");
    expect(json.data.otpAuthUrl).toContain("otpauth://totp/");
    expect(json.data.qrCodeSvg.startsWith("<svg")).toBe(true);

    expect(vi.mocked(beginTotpEnrollment)).toHaveBeenCalledWith("test-user");
  });

  it("maps 'already_enabled' to HTTP 409 with the error code in the body", async () => {
    vi.mocked(beginTotpEnrollment).mockRejectedValueOnce(
      new TotpServiceError("Two-factor is already enabled", {
        code: "already_enabled",
        statusCode: 409,
      }),
    );

    const response = await POST(buildRequest());
    expect(response.status).toBe(409);

    const json = (await response.json()) as { error: string; code: string };
    expect(json.code).toBe("already_enabled");
    expect(json.error).toMatch(/already enabled/i);
  });

  it("returns 500 with a generic message for unexpected errors", async () => {
    vi.mocked(beginTotpEnrollment).mockRejectedValueOnce(
      new Error("database is down"),
    );

    const response = await POST(buildRequest());
    expect(response.status).toBe(500);

    const json = (await response.json()) as { error: string; code?: string };
    // Internal details must not leak through to the client.
    expect(json.error).not.toContain("database is down");
    expect(json.code).toBeUndefined();
  });
});
