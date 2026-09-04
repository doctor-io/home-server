import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockReadPushConfig } = vi.hoisted(() => ({ mockReadPushConfig: vi.fn() }));

vi.mock("@/lib/server/modules/notifications/push-config", () => ({
  readPushConfig: mockReadPushConfig,
  DEFAULT_NTFY_URL: "https://ntfy.sh",
}));

import {
  PING_TAG,
  describePushFailure,
  dispatchPush,
  ntfyTransport,
} from "@/lib/server/modules/notifications/push-service";
import type { NotificationRecord } from "@/lib/shared/contracts/notifications";

const notification: NotificationRecord = {
  id: "n1",
  title: "jellyfin stopped",
  body: "The container exited with code 1",
  kind: "error",
  read: false,
  createdAt: new Date().toISOString(),
};

const configured = {
  enabled: true,
  ntfyUrl: "https://ntfy.sh",
  ntfyTopic: "homeio-abc",
  ntfyToken: null,
  includeContent: true,
};

/** The default: the relay is told that something happened and nothing else. */
const pinging = { ...configured, includeContent: false };

beforeEach(() => {
  vi.clearAllMocks();
  mockReadPushConfig.mockResolvedValue(configured);
});

describe("dispatchPush", () => {
  it("sends when push is on and a topic is set", async () => {
    const transport = { name: "test", send: vi.fn(async () => undefined) };

    await dispatchPush(notification, transport);

    expect(transport.send).toHaveBeenCalledWith(notification, configured);
  });

  it("stays quiet when push is off", async () => {
    mockReadPushConfig.mockResolvedValue({ ...configured, enabled: false });
    const transport = { name: "test", send: vi.fn(async () => undefined) };

    await dispatchPush(notification, transport);

    expect(transport.send).not.toHaveBeenCalled();
  });

  it("stays quiet when nothing has been configured to send to", async () => {
    mockReadPushConfig.mockResolvedValue({ ...configured, ntfyTopic: null });
    const transport = { name: "test", send: vi.fn(async () => undefined) };

    await dispatchPush(notification, transport);

    expect(transport.send).not.toHaveBeenCalled();
  });

  it("swallows a transport failure", async () => {
    const transport = {
      name: "test",
      send: vi.fn(async () => {
        throw new Error("ntfy is down");
      }),
    };

    // The row is already written and the SSE stream has already fired by the
    // time this runs. An unreachable ntfy must not take down the notification
    // that was trying to report a problem in the first place.
    await expect(dispatchPush(notification, transport)).resolves.toBeUndefined();
  });

  it("swallows a failure to even read the configuration", async () => {
    mockReadPushConfig.mockRejectedValue(new Error("database is unreachable"));
    const transport = { name: "test", send: vi.fn(async () => undefined) };

    await expect(dispatchPush(notification, transport)).resolves.toBeUndefined();
    expect(transport.send).not.toHaveBeenCalled();
  });
});

describe("ntfyTransport", () => {
  function captureFetch(response = { ok: true, status: 200 }) {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => response as Response);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  function bodyOf(init: RequestInit | undefined) {
    return JSON.parse(String(init?.body)) as {
      title: string;
      message: string;
      priority: number;
      tags: string[];
    };
  }

  it("posts the notification as JSON, not as headers", async () => {
    const fetchMock = captureFetch();

    await ntfyTransport.send(notification, configured);

    const [url, init] = fetchMock.mock.calls[0];
    const body = bodyOf(init);

    // Header values must be Latin-1 and single-line; titles carry unicode and
    // bodies carry newlines, so the payload goes in the body where neither rule
    // applies.
    expect(url).toBe("https://ntfy.sh");
    expect(body).toMatchObject({
      topic: "homeio-abc",
      title: "jellyfin stopped",
      message: "The container exited with code 1",
    });
  });

  it("makes a crash urgent and an info message quiet", async () => {
    const fetchMock = captureFetch();

    await ntfyTransport.send(notification, configured);
    await ntfyTransport.send({ ...notification, kind: "info" }, configured);

    const priorities = fetchMock.mock.calls.map((call) => bodyOf(call[1]).priority);

    // A stopped container should wake someone; a routine message should not.
    expect(priorities[0]).toBe(5);
    expect(priorities[1]).toBe(2);
  });

  it("carries a token only when one is configured", async () => {
    const withToken = captureFetch();
    await ntfyTransport.send(notification, { ...configured, ntfyToken: "tk_secret" });
    const authed = withToken.mock.calls[0][1]?.headers as Record<string, string>;
    expect(authed.Authorization).toBe("Bearer tk_secret");

    const withoutToken = captureFetch();
    await ntfyTransport.send(notification, configured);
    const anonymous = withoutToken.mock.calls[0][1]?.headers as Record<string, string>;
    expect(anonymous.Authorization).toBeUndefined();
  });

  it("trims a trailing slash off a self-hosted URL", async () => {
    const fetchMock = captureFetch();

    await ntfyTransport.send(notification, {
      ...configured,
      ntfyUrl: "https://ntfy.example.com/",
    });

    expect(fetchMock.mock.calls[0][0]).toBe("https://ntfy.example.com");
  });

  it("treats a non-2xx answer as a failure", async () => {
    captureFetch({ ok: false, status: 403 });

    await expect(ntfyTransport.send(notification, configured)).rejects.toThrow("403");
  });

  it("does nothing at all without a topic", async () => {
    const fetchMock = captureFetch();

    await ntfyTransport.send(notification, { ...configured, ntfyTopic: null });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("describePushFailure", () => {
  it("names the host and the reason a connection did not happen", () => {
    // Node reports both a refused port and an unresolvable name as the same
    // bare "fetch failed", with the only useful detail hidden on `cause`.
    const refused = new TypeError("fetch failed", {
      cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
    });

    expect(describePushFailure(refused, "http://nas.local:8080")).toBe(
      "Could not reach http://nas.local:8080 (ECONNREFUSED)",
    );
  });

  it("says a timeout is a timeout, with the limit", () => {
    const aborted = Object.assign(new Error("This operation was aborted"), {
      name: "AbortError",
    });

    expect(describePushFailure(aborted, "https://ntfy.sh")).toBe(
      "https://ntfy.sh did not answer within 5 seconds",
    );
  });

  it("passes through what ntfy itself said", () => {
    // A 403 is the operator's answer about their token, not a network problem.
    expect(describePushFailure(new Error("ntfy answered 403"), "https://ntfy.sh")).toBe(
      "ntfy answered 403",
    );
  });

  it("still says something useful for a failure with no cause at all", () => {
    expect(describePushFailure(new TypeError("fetch failed"), "https://ntfy.sh")).toBe(
      "Could not reach https://ntfy.sh",
    );
    expect(describePushFailure("not an error", "https://ntfy.sh")).toBe(
      "Could not reach https://ntfy.sh",
    );
  });
});

describe("ping mode", () => {
  function captureFetch() {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      ({ ok: true, status: 200 }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  function bodyOf(init: RequestInit | undefined) {
    return JSON.parse(String(init?.body)) as {
      title: string;
      message: string;
      priority: number;
      tags: string[];
    };
  }

  it("hands the relay no part of the notification", async () => {
    const fetchMock = captureFetch();

    await ntfyTransport.send(notification, pinging);

    const sent = JSON.stringify(fetchMock.mock.calls[0][1]?.body);
    // "jellyfin stopped" tells whoever runs the relay rather a lot about a
    // household, and this is the whole point of the mode.
    expect(sent).not.toContain("jellyfin");
    expect(sent).not.toContain("exited");
    expect(bodyOf(fetchMock.mock.calls[0][1]).title).toBe("Homeio");
  });

  it("says the same thing for every notification", async () => {
    const fetchMock = captureFetch();

    await ntfyTransport.send(notification, pinging);
    await ntfyTransport.send(
      { ...notification, title: "Backup finished", body: "42 GB", kind: "success" },
      pinging,
    );

    const [first, second] = fetchMock.mock.calls.map((call) => bodyOf(call[1]));
    expect(first.message).toBe(second.message);
    expect(first.title).toBe(second.title);
  });

  it("keeps priority, because a silent crash alert is not an alert", async () => {
    const fetchMock = captureFetch();

    await ntfyTransport.send(notification, pinging);
    await ntfyTransport.send({ ...notification, kind: "info" }, pinging);

    const [crash, routine] = fetchMock.mock.calls.map((call) => bodyOf(call[1]));
    // One of three severity levels escapes, with no subject attached. That is
    // the considered trade: without it the phone cannot know to wake anyone.
    expect(crash.priority).toBe(5);
    expect(routine.priority).toBe(2);
  });

  it("marks the push so the app knows to go and read the real one", async () => {
    const fetchMock = captureFetch();

    await ntfyTransport.send(notification, pinging);

    expect(bodyOf(fetchMock.mock.calls[0][1]).tags).toContain(PING_TAG);
  });

  it("does not mark a push that already carries the text", async () => {
    const fetchMock = captureFetch();

    await ntfyTransport.send(notification, configured);

    const body = bodyOf(fetchMock.mock.calls[0][1]);
    expect(body.tags).not.toContain(PING_TAG);
    expect(body.title).toBe("jellyfin stopped");
  });
});
