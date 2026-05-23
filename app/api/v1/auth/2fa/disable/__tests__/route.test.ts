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
  disableTotp: vi.fn(),
}));

import { POST } from "@/app/api/v1/auth/2fa/disable/route";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import {
  TotpServiceError,
  disableTotp,
} from "@/lib/server/modules/auth/totp-service";

const buildRequest = (body: unknown) =>
  new Request("http://localhost/api/v1/auth/2fa/disable", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const VALID_BODY = { code: "123456" };

beforeEach(() => {
  vi.mocked(disableTotp).mockReset();
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

describe("POST /api/v1/auth/2fa/disable", () => {
  it("returns 401 when the session cannot be authenticated", async () => {
    vi.mocked(requireApiSession).mockResolvedValueOnce({
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await POST(buildRequest(VALID_BODY));
    expect(response.status).toBe(401);
    expect(vi.mocked(disableTotp)).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed JSON body", async () => {
    const response = await POST(buildRequest("{not json"));
    expect(response.status).toBe(400);
    expect(vi.mocked(disableTotp)).not.toHaveBeenCalled();
  });

  it("returns 400 when the body is missing 'code'", async () => {
    const response = await POST(buildRequest({}));
    expect(response.status).toBe(400);
    expect(vi.mocked(disableTotp)).not.toHaveBeenCalled();
  });

  it("returns 200 with { enabled: false } on a successful TOTP disable", async () => {
    vi.mocked(disableTotp).mockResolvedValueOnce({ enabled: false });

    const response = await POST(buildRequest(VALID_BODY));
    expect(response.status).toBe(200);

    const json = (await response.json()) as { data: { enabled: boolean } };
    expect(json.data).toEqual({ enabled: false });

    expect(vi.mocked(disableTotp)).toHaveBeenCalledWith({
      userId: "test-user",
      code: "123456",
    });
  });

  it("passes a backup-code style payload straight through to the service", async () => {
    vi.mocked(disableTotp).mockResolvedValueOnce({ enabled: false });

    const response = await POST(
      buildRequest({ code: "AAAA-AAAA-AA" }),
    );
    expect(response.status).toBe(200);
    expect(vi.mocked(disableTotp)).toHaveBeenCalledWith({
      userId: "test-user",
      code: "AAAA-AAAA-AA",
    });
  });

  it("maps invalid_totp to 400 with the code in the body", async () => {
    vi.mocked(disableTotp).mockRejectedValueOnce(
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

  it("maps not_enabled to 409", async () => {
    vi.mocked(disableTotp).mockRejectedValueOnce(
      new TotpServiceError("Not enabled", {
        code: "not_enabled",
        statusCode: 409,
      }),
    );

    const response = await POST(buildRequest(VALID_BODY));
    expect(response.status).toBe(409);

    const json = (await response.json()) as { code: string };
    expect(json.code).toBe("not_enabled");
  });

  it("maps not_enrolled (ghost user) to 401", async () => {
    vi.mocked(disableTotp).mockRejectedValueOnce(
      new TotpServiceError("User not found", {
        code: "not_enrolled",
        statusCode: 401,
      }),
    );

    const response = await POST(buildRequest(VALID_BODY));
    expect(response.status).toBe(401);

    const json = (await response.json()) as { code: string };
    expect(json.code).toBe("not_enrolled");
  });

  it("returns 500 with a generic message for unexpected errors", async () => {
    vi.mocked(disableTotp).mockRejectedValueOnce(
      new Error("database is down"),
    );

    const response = await POST(buildRequest(VALID_BODY));
    expect(response.status).toBe(500);

    const json = (await response.json()) as { error: string; code?: string };
    expect(json.error).not.toContain("database is down");
    expect(json.code).toBeUndefined();
  });
});
