/* @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/shared/query-keys";
import { useNetworkActions } from "@/hooks/useNetworkActions";
import { createTestQueryClient, createWrapper } from "@/test/query-client-wrapper";

describe("useNetworkActions", () => {
  it("calls connect and disconnect endpoints and invalidates queries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            connected: true,
            iface: "wlan0",
            ssid: "HomeNet",
            ipv4: "192.168.1.12",
            signalPercent: 65,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            connected: false,
            iface: "wlan0",
            ssid: null,
            ipv4: null,
            signalPercent: null,
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useNetworkActions(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.connectNetwork({
        ssid: "HomeNet",
        password: "secret",
      });
      await result.current.disconnectNetwork({
        iface: "wlan0",
      });
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/v1/network/connect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ssid: "HomeNet",
        password: "secret",
      }),
    });

    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/v1/network/disconnect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        iface: "wlan0",
      }),
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.networkStatus,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.networkNetworks,
    });
  });
});
