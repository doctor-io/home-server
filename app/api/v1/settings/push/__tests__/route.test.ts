import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as PushService from "@/lib/server/modules/notifications/push-service";

const { mockRead, mockWrite, mockSend } = vi.hoisted(() => ({
  mockRead: vi.fn(),
  mockWrite: vi.fn(),
  mockSend: vi.fn(),
}));

vi.mock("@/lib/server/modules/notifications/push-config", () => ({
  readPushConfig: mockRead,
  writePushConfig: mockWrite,
  // The route uses the real one: it is what keeps the token out of the response.
  toPublicPushConfig: (config: {
    enabled: boolean;
    ntfyUrl: string;
    ntfyTopic: string | null;
    ntfyToken: string | null;
    includeContent: boolean;
  }) => ({
    enabled: config.enabled,
    ntfyUrl: config.ntfyUrl,
    ntfyTopic: config.ntfyTopic,
    hasToken: config.ntfyToken !== null,
    includeContent: config.includeContent,
  }),
}));

vi.mock("@/lib/server/modules/notifications/push-service", async () => {
  const actual = await vi.importActual<typeof PushService>(
    "@/lib/server/modules/notifications/push-service",
  );

  return { ...actual, ntfyTransport: { name: "ntfy", send: mockSend } };
});

import { GET, PUT } from "@/app/api/v1/settings/push/route";
import { POST as TEST_POST } from "@/app/api/v1/settings/push/test/route";

const saved = {
  enabled: true,
  ntfyUrl: "https://ntfy.sh",
  ntfyTopic: "homeio-abcdefghijklmnop",
  ntfyToken: "tk_secret",
  includeContent: false,
};

function put(body: unknown) {
  return PUT(
    new Request("http://localhost/api/v1/settings/push", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRead.mockResolvedValue(saved);
  mockWrite.mockResolvedValue(undefined);
  mockSend.mockResolvedValue(undefined);
});

describe("GET /api/v1/settings/push", () => {
  it("reports that a token exists without ever returning it", async () => {
    const response = await GET(new Request("http://localhost/api/v1/settings/push"));
    const json = await response.json();

    expect(json.data).toEqual({
      enabled: true,
      ntfyUrl: "https://ntfy.sh",
      ntfyTopic: "homeio-abcdefghijklmnop",
      hasToken: true,
      includeContent: false,
    });
    expect(JSON.stringify(json)).not.toContain("tk_secret");
  });
});

describe("caching", () => {
  it("forbids storing the push config, on every answer that carries it", async () => {
    // A proxy applying a default max-age to a JSON GET served a stale config
    // for a day on a live server: the phone's switch kept insisting push was
    // off minutes after it had been turned on.
    const read = await GET(new Request("http://localhost/api/v1/settings/push"));
    const written = await put({
      enabled: true,
      ntfyUrl: "https://ntfy.sh",
      ntfyTopic: "homeio-alerts",
    });

    expect(read.headers.get("Cache-Control")).toBe("no-store");
    expect(written.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("PUT /api/v1/settings/push", () => {
  it("saves a valid config", async () => {
    const response = await put({
      enabled: true,
      ntfyUrl: "https://ntfy.sh/",
      ntfyTopic: " homeio-alerts ",
    });

    expect(response.status).toBe(200);
    expect(mockWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        ntfyUrl: "https://ntfy.sh",
        ntfyTopic: "homeio-alerts",
      }),
    );
  });

  it("refuses to arm push with nowhere to send", async () => {
    // Enabled with no topic is a switch that looks on and does nothing, which
    // is the one state an alerting feature must never be left in.
    const response = await put({ enabled: true, ntfyUrl: "https://ntfy.sh", ntfyTopic: "" });

    expect(response.status).toBe(400);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it("lets a topic be saved while push is still off, so it can be tested first", async () => {
    const response = await put({
      enabled: false,
      ntfyUrl: "https://ntfy.sh",
      ntfyTopic: "homeio-alerts",
    });

    expect(response.status).toBe(200);
    expect(mockWrite).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, ntfyTopic: "homeio-alerts" }),
    );
  });

  it("rejects a topic ntfy would not accept, and a URL that is not a web address", async () => {
    expect((await put({ enabled: true, ntfyUrl: "https://ntfy.sh", ntfyTopic: "a b" })).status).toBe(
      400,
    );
    expect(
      (await put({ enabled: true, ntfyUrl: "file:///etc/passwd", ntfyTopic: "homeio" })).status,
    ).toBe(400);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it("only hands the relay the alert text when asked in so many words", async () => {
    // Anything but an explicit true keeps the text off the wire, so a client
    // that has never heard of this setting cannot turn it on by omission.
    await put({ enabled: true, ntfyUrl: "https://ntfy.sh", ntfyTopic: "homeio-alerts" });
    expect(mockWrite).toHaveBeenCalledWith(expect.objectContaining({ includeContent: false }));

    await put({
      enabled: true,
      ntfyUrl: "https://ntfy.sh",
      ntfyTopic: "homeio-alerts",
      includeContent: true,
    });
    expect(mockWrite).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeContent: true }),
    );
  });

  it("leaves the stored token alone when the field was not touched", async () => {
    // The UI never receives the token, so it cannot echo it back — an omitted
    // key has to mean "keep", or saving the toggle would wipe the credential.
    await put({ enabled: true, ntfyUrl: "https://ntfy.sh", ntfyTopic: "homeio-alerts" });

    expect(mockWrite).toHaveBeenCalledWith(
      expect.objectContaining({ ntfyToken: undefined }),
    );
  });

  it("clears the token on an explicit null", async () => {
    await put({
      enabled: true,
      ntfyUrl: "https://ntfy.sh",
      ntfyTopic: "homeio-alerts",
      ntfyToken: null,
    });

    expect(mockWrite).toHaveBeenCalledWith(expect.objectContaining({ ntfyToken: null }));
  });
});

describe("POST /api/v1/settings/push/test", () => {
  function post() {
    return TEST_POST(
      new Request("http://localhost/api/v1/settings/push/test", { method: "POST" }),
    );
  }

  it("sends through the saved config", async () => {
    const response = await post();

    expect(response.status).toBe(200);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("test") }),
      saved,
    );
  });

  it("sends even while push is off, so a topic can be proven before it is armed", async () => {
    mockRead.mockResolvedValue({ ...saved, enabled: false });

    expect((await post()).status).toBe(200);
    expect(mockSend).toHaveBeenCalled();
  });

  it("says why it failed, unlike the dispatcher that swallows it", async () => {
    // A wrong token answers 403 and a typo'd host does not resolve; the operator
    // needs to know which, because the two need different fixes.
    mockSend.mockRejectedValue(new Error("ntfy answered 403"));

    const response = await post();

    expect(response.status).toBe(502);
    expect((await response.json()).error).toBe("ntfy answered 403");
  });

  it("names the host when the connection never happened", async () => {
    // "fetch failed" on its own sends the operator nowhere.
    mockSend.mockRejectedValue(
      new TypeError("fetch failed", {
        cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
      }),
    );

    const response = await post();

    expect((await response.json()).error).toBe(
      "Could not reach https://ntfy.sh (ECONNREFUSED)",
    );
  });

  it("refuses when there is no topic to send to", async () => {
    mockRead.mockResolvedValue({ ...saved, ntfyTopic: null });

    expect((await post()).status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
