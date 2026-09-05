import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as PairingServiceModule from "@/lib/server/modules/auth/pairing-service";

const { mockRequireApiSession, mockCreate, mockClaim, mockPurge } = vi.hoisted(() => ({
  mockRequireApiSession: vi.fn(),
  mockCreate: vi.fn(),
  mockClaim: vi.fn(),
  mockPurge: vi.fn(),
}));

vi.mock("@/lib/server/modules/auth/api", async () => {
  const { NextResponse: Res } = await import("next/server");
  return {
    requireApiSession: mockRequireApiSession,
    unauthorizedApiResponse: () => Res.json({ error: "Unauthorized" }, { status: 401 }),
  };
});

vi.mock("@/lib/server/modules/auth/pairing-service", async () => {
  const actual = await vi.importActual<typeof PairingServiceModule>(
    "@/lib/server/modules/auth/pairing-service",
  );

  return {
    ...actual,
    createPairingCode: mockCreate,
    claimPairingCode: mockClaim,
    purgeStalePairingCodes: mockPurge,
  };
});

import { POST as mint } from "@/app/api/v1/auth/pairing/route";
import { POST as claim } from "@/app/api/v1/auth/pairing/claim/route";
import { PairingError } from "@/lib/server/modules/auth/pairing-service";
import { _resetLoginRateLimitForTesting } from "@/lib/server/modules/auth/rate-limit";

function mintRequest() {
  return new NextRequest("https://homeio.example.com/api/v1/auth/pairing", {
    method: "POST",
    headers: { cookie: "homeio_session=t" },
  });
}

function claimRequest(body: unknown) {
  return new NextRequest("https://homeio.example.com/api/v1/auth/pairing/claim", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetLoginRateLimitForTesting();
  mockRequireApiSession.mockResolvedValue({
    session: {
      sessionId: "s",
      userId: "user-1",
      username: "ahmed",
      passwordHash: "h",
      expiresAt: new Date(),
    },
    response: null,
  });
  mockCreate.mockResolvedValue({
    code: "test-code",
    expiresAt: new Date(Date.now() + 60_000),
  });
  mockPurge.mockResolvedValue(undefined);
});

describe("POST /api/v1/auth/pairing", () => {
  it("carries the server's own address in the QR, not just the code", async () => {
    const body = await (await mint(mintRequest())).json();

    // A phone that still has to be told the tailnet name by hand has not been
    // saved any typing, which is the entire point of the feature.
    expect(body.data.url).toContain(encodeURIComponent("https://homeio.example.com"));
    expect(body.data.url).toContain("code=test-code");
    expect(body.data.url.startsWith("homeio://pair?")).toBe(true);
  });

  it("uses the address the browser reached, not the one the server binds", async () => {
    // Reproduces the real failure: with a custom server, request.url reports
    // Next's own bind address whatever Host the client sent, so the QR told the
    // phone to connect to localhost — which on a phone is the phone.
    const body = await (
      await mint(
        new NextRequest("http://localhost:3000/api/v1/auth/pairing", {
          method: "POST",
          headers: { cookie: "homeio_session=t", host: "192.168.1.37:3000" },
        }),
      )
    ).json();

    expect(body.data.url).toContain(encodeURIComponent("http://192.168.1.37:3000"));
    expect(body.data.url).not.toContain(encodeURIComponent("localhost"));
  });

  it("prefers the forwarded address and scheme behind a proxy", async () => {
    const body = await (
      await mint(
        new NextRequest("http://localhost:3000/api/v1/auth/pairing", {
          method: "POST",
          headers: {
            cookie: "homeio_session=t",
            host: "127.0.0.1:3000",
            "x-forwarded-host": "homeio.tail1234.ts.net",
            "x-forwarded-proto": "https",
          },
        }),
      )
    ).json();

    expect(body.data.url).toContain(
      encodeURIComponent("https://homeio.tail1234.ts.net"),
    );
  });

  it("returns an SVG the settings page can render inline", async () => {
    const body = await (await mint(mintRequest())).json();

    expect(body.data.qrSvg).toContain("<svg");
    expect(body.data.expiresAt).toBeTypeOf("string");
  });

  it("refuses to mint for a caller without a session", async () => {
    const { NextResponse } = await import("next/server");
    mockRequireApiSession.mockResolvedValue({
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    expect((await mint(mintRequest())).status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/auth/pairing/claim", () => {
  it("answers a valid code with a session cookie", async () => {
    mockClaim.mockResolvedValue({
      token: "session.token.value",
      expiresAt: new Date(Date.now() + 3_600_000),
      userId: "user-1",
    });

    const response = await claim(claimRequest({ code: "test-code" }));

    expect(response.status).toBe(200);
    expect(response.cookies.get("homeio_session")?.value).toBe("session.token.value");
  });

  it("never consults a session of its own", async () => {
    mockClaim.mockResolvedValue({
      token: "t",
      expiresAt: new Date(),
      userId: "user-1",
    });

    await claim(claimRequest({ code: "test-code" }));

    // The whole point: the caller has no session, so the route must not ask for
    // one. If this ever starts calling the helper, pairing is broken.
    expect(mockRequireApiSession).not.toHaveBeenCalled();
  });

  it("refuses a code the service rejects, without a cookie", async () => {
    mockClaim.mockRejectedValue(new PairingError("invalid_code", "This pairing code is not valid"));

    const response = await claim(claimRequest({ code: "stale" }));

    expect(response.status).toBe(401);
    expect(response.cookies.get("homeio_session")).toBeUndefined();
  });

  it("rejects a malformed body before touching the service", async () => {
    const response = await claim(claimRequest({ nope: true }));

    expect(response.status).toBe(400);
    expect(mockClaim).not.toHaveBeenCalled();
  });

  it("stops guessing after the login limit, and stops paying for it", async () => {
    mockClaim.mockRejectedValue(new PairingError("invalid_code", "This pairing code is not valid"));

    for (let i = 0; i < 5; i += 1) {
      expect((await claim(claimRequest({ code: `guess-${i}` }))).status).toBe(401);
    }

    const limited = await claim(claimRequest({ code: "guess-6" }));
    expect(limited.status).toBe(429);

    // Six attempts reached the service, the seventh did not: a rate limit that
    // still runs the work it is limiting protects nothing.
    expect(mockClaim).toHaveBeenCalledTimes(5);
  });
});
