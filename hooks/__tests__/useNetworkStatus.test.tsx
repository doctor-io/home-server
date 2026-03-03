/* @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { createTestQueryClient, createWrapper } from "@/test/query-client-wrapper";

describe("useNetworkStatus", () => {
  it("loads network status from api", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          connected: true,
          iface: "wlan0",
          ssid: "HomeNet",
          ipv4: "192.168.1.12",
          signalPercent: 70,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();
    const { result } = renderHook(() => useNetworkStatus(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.ssid).toBe("HomeNet");
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/network/status", {
      cache: "no-store",
    });
  });
});
