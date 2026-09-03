import { describe, expect, it } from "vitest";
import { pushRowState } from "@/modules/phone/push-subscription";

const armed = {
  enabled: true,
  ntfyUrl: "https://ntfy.sh",
  ntfyTopic: "homeio-abcdefghijklmnop",
  hasToken: false,
};

describe("pushRowState", () => {
  it("offers to subscribe when the server is publishing and this phone is not listening", () => {
    expect(pushRowState(armed, null)).toEqual({
      kind: "off",
      url: "https://ntfy.sh",
      topic: "homeio-abcdefghijklmnop",
    });
  });

  it("reads as on only when subscribed to the topic the server actually uses", () => {
    expect(pushRowState(armed, "homeio-abcdefghijklmnop").kind).toBe("on");
  });

  it("reads as off when the operator rotated the topic", () => {
    // The phone is still listening, but to an address nothing publishes to any
    // more. Showing that as "on" would leave someone waiting for alerts that
    // can never arrive; showing it as off makes the switch fix it.
    expect(pushRowState(armed, "homeio-the-old-one").kind).toBe("off");
  });

  it("says the server side is the missing half when push is not armed there", () => {
    expect(pushRowState({ ...armed, enabled: false }, null).kind).toBe("server-off");
    expect(pushRowState({ ...armed, ntfyTopic: null }, null).kind).toBe("server-off");
    // Subscribed, but the server stopped publishing: still the server's half.
    expect(pushRowState({ ...armed, enabled: false }, "homeio-abcdefghijklmnop").kind).toBe(
      "server-off",
    );
  });

  it("says the same for a server too old to have the endpoint at all", () => {
    // A v1.7 server answers 404 and the caller passes null — the row must not
    // claim anything about a feature that server does not have.
    expect(pushRowState(null, null).kind).toBe("server-off");
  });
});
