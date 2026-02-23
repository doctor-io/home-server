import { describe, expect, it } from "vitest";
import {
  ALLOWED_METHODS,
  HelperProtocolError,
  parseRpcRequest,
  toErrorPayload,
} from "@/services/dbus-helper/protocol.mjs";

describe("dbus helper protocol", () => {
  it("enforces method allowlist", () => {
    expect(ALLOWED_METHODS.has("network.getStatus")).toBe(true);
    expect(ALLOWED_METHODS.has("network.reboot")).toBe(false);

    expect(() =>
      parseRpcRequest(
        JSON.stringify({
          id: "1",
          method: "network.reboot",
        }),
      ),
    ).toThrow(HelperProtocolError);
  });

  it("validates connect and disconnect parameters", () => {
    const connect = parseRpcRequest(
      JSON.stringify({
        id: "1",
        method: "network.connect",
        params: {
          ssid: "HomeNet",
          password: "secret",
        },
      }),
    );

    expect(connect.method).toBe("network.connect");
    expect(connect.params).toEqual({
      ssid: "HomeNet",
      password: "secret",
    });

    const disconnect = parseRpcRequest(
      JSON.stringify({
        id: "2",
        method: "network.disconnect",
        params: {
          iface: "wlan0",
        },
      }),
    );

    expect(disconnect.params).toEqual({
      iface: "wlan0",
    });
  });

  it("maps structured errors to protocol payloads", () => {
    const payload = toErrorPayload({
      code: "auth_failed",
      message: "Invalid Wi-Fi password",
    });

    expect(payload).toEqual({
      code: "auth_failed",
      message: "Invalid Wi-Fi password",
    });
  });
});
