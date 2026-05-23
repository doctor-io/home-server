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
  completeTotpLogin: vi.fn(),
}));

import { POST } from "@/app/api/v1/auth/login/totp/route";
import {
  TotpServiceError,
  completeTotpLogin,
} from "@/lib/server/modules/auth/totp-service";

const buildRequest = (body: unknown, init: RequestInit = {}) =>
  new Request("http://localhost/api/v1/auth/login/totp", {
    method: "POST",
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });

const VALID_BODY = {
  partialAuthToken: "partial.user-1.99999999.deadbeef",
  code: "123456",
};

beforeEach(() => {
  vi.mocked(completeTotpLogin).mockReset();
});

describe("POST /api/v1/auth/login/totp", () => {
  it("returns 400 for a malformed JSON body", async () => {
    const response = await POST(buildRequest("{not json"));
    expect(response.status).toBe(400);
    expect(vi.mocked(completeTotpLogin)).not.toHaveBeenCalled();
  });

  it("returns 400 when fields are missing", async () => {
    const response = await POST(buildRequest({ code: "123456" }));
    expect(response.status).toBe(400);
    expect(vi.mocked(completeTotpLogin)).not.toHaveBeenCalled();
  });

  it("sets a session cookie and returns the user on success", async () => {
    vi.mocked(completeTotpLogin).mockResolvedValueOnce({
      sessionToken: "session-token",
      sessionExpiresAt: new Date(Date.now() + 3600_000),
      user: { id: "user-1", username: "admin" },
    });

    const response = await POST(buildRequest(VALID_BODY));
    expect(response.status).toBe(200);

    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("homeio_session=session-token");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).not.toContain("Secure");

    const json = (await response.json()) as {
      data: { id: string; username: string };
    };
    expect(json.data).toEqual({ id: "user-1", username: "admin" });

    expect(vi.mocked(completeTotpLogin)).toHaveBeenCalledWith({
      partialAuthToken: VALID_BODY.partialAuthToken,
      code: VALID_BODY.code,
    });
  });

  it("sets a Secure cookie when the proxy reports https", async () => {
    vi.mocked(completeTotpLogin).mockResolvedValueOnce({
      sessionToken: "session-token",
      sessionExpiresAt: new Date(Date.now() + 3600_000),
      user: { id: "user-1", username: "admin" },
    });

    const response = await POST(
      buildRequest(VALID_BODY, { headers: { "x-forwarded-proto": "https" } }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie") ?? "").toContain("Secure");
  });

  it("maps partial_auth_expired to 401 without setting a cookie", async () => {
    vi.mocked(completeTotpLogin).mockRejectedValueOnce(
      new TotpServiceError("Partial-auth token is invalid or expired", {
        code: "partial_auth_expired",
        statusCode: 401,
      }),
    );

    const response = await POST(buildRequest(VALID_BODY));
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();

    const json = (await response.json()) as { code: string };
    expect(json.code).toBe("partial_auth_expired");
  });

  it("maps invalid_totp to 401 without setting a cookie", async () => {
    vi.mocked(completeTotpLogin).mockRejectedValueOnce(
      new TotpServiceError("Invalid verification code", {
        code: "invalid_totp",
        statusCode: 401,
      }),
    );

    const response = await POST(buildRequest(VALID_BODY));
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();

    const json = (await response.json()) as { code: string };
    expect(json.code).toBe("invalid_totp");
  });

  it("returns 500 with a generic message for unexpected errors", async () => {
    vi.mocked(completeTotpLogin).mockRejectedValueOnce(
      new Error("database is down"),
    );

    const response = await POST(buildRequest(VALID_BODY));
    expect(response.status).toBe(500);

    const json = (await response.json()) as { error: string; code?: string };
    expect(json.error).not.toContain("database is down");
    expect(json.code).toBeUndefined();
  });
});
