import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/auth/totp-service", () => ({
  TotpServiceError: class TotpServiceError extends Error {
    code: string;
    statusCode: number;
    publicMessage: string;

    constructor(
      message: string,
      options: {
        code: string;
        statusCode: number;
        publicMessage?: string;
      },
    ) {
      super(message);
      this.name = "TotpServiceError";
      this.code = options.code;
      this.statusCode = options.statusCode;
      this.publicMessage = options.publicMessage ?? message;
    }
  },
  completeTotpEnrollment: vi.fn(),
}));

import { POST } from "@/app/api/v1/auth/2fa/verify/route";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import {
  TotpServiceError,
  completeTotpEnrollment,
} from "@/lib/server/modules/auth/totp-service";

const buildRequest = (body: unknown) =>
  new Request("http://localhost/api/v1/auth/2fa/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const VALID_BODY = { code: "123456" };

beforeEach(() => {
  vi.mocked(completeTotpEnrollment).mockReset();
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

describe("POST /api/v1/auth/2fa/verify", () => {
  it("returns 401 when the session cannot be authenticated", async () => {
    vi.mocked(requireApiSession).mockResolvedValueOnce({
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await POST(buildRequest(VALID_BODY));
    expect(response.status).toBe(401);
    expect(vi.mocked(completeTotpEnrollment)).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed JSON body", async () => {
    const response = await POST(buildRequest("{not json"));
    expect(response.status).toBe(400);
    expect(vi.mocked(completeTotpEnrollment)).not.toHaveBeenCalled();
  });

  it("returns 400 when the body is missing 'code'", async () => {
    const response = await POST(buildRequest({}));
    expect(response.status).toBe(400);
    expect(vi.mocked(completeTotpEnrollment)).not.toHaveBeenCalled();
  });

  it("returns 200 with the backup codes on success", async () => {
    vi.mocked(completeTotpEnrollment).mockResolvedValueOnce({
      enabled: true,
      enrolledAt: "2026-05-23T13:00:00.000Z",
      backupCodes: ["AAAAA11111", "BBBBB22222"],
    });

    const response = await POST(buildRequest(VALID_BODY));
    expect(response.status).toBe(200);

    const json = (await response.json()) as {
      data: {
        enabled: boolean;
        enrolledAt: string;
        backupCodes: string[];
      };
    };
    expect(json.data.enabled).toBe(true);
    expect(json.data.backupCodes).toEqual(["AAAAA11111", "BBBBB22222"]);

    expect(vi.mocked(completeTotpEnrollment)).toHaveBeenCalledWith({
      userId: "test-user",
      code: "123456",
    });
  });

  it("maps invalid_totp to 400 with the code in the body", async () => {
    vi.mocked(completeTotpEnrollment).mockRejectedValueOnce(
      new TotpServiceError("Invalid verification code", {
        code: "invalid_totp",
        statusCode: 400,
      }),
    );

    const response = await POST(buildRequest(VALID_BODY));
    expect(response.status).toBe(400);

    const json = (await response.json()) as { error: string; code: string };
    expect(json.code).toBe("invalid_totp");
  });

  it("maps already_enabled to 409", async () => {
    vi.mocked(completeTotpEnrollment).mockRejectedValueOnce(
      new TotpServiceError("Already enabled", {
        code: "already_enabled",
        statusCode: 409,
      }),
    );

    const response = await POST(buildRequest(VALID_BODY));
    expect(response.status).toBe(409);

    const json = (await response.json()) as { code: string };
    expect(json.code).toBe("already_enabled");
  });

  it("maps no_pending_enrollment to 409", async () => {
    vi.mocked(completeTotpEnrollment).mockRejectedValueOnce(
      new TotpServiceError("No pending enrolment", {
        code: "no_pending_enrollment",
        statusCode: 409,
      }),
    );

    const response = await POST(buildRequest(VALID_BODY));
    expect(response.status).toBe(409);

    const json = (await response.json()) as { code: string };
    expect(json.code).toBe("no_pending_enrollment");
  });

  it("returns 500 with a generic message for unexpected errors", async () => {
    vi.mocked(completeTotpEnrollment).mockRejectedValueOnce(
      new Error("database is down"),
    );

    const response = await POST(buildRequest(VALID_BODY));
    expect(response.status).toBe(500);

    const json = (await response.json()) as { error: string; code?: string };
    expect(json.error).not.toContain("database is down");
    expect(json.code).toBeUndefined();
  });
});
