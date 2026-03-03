/* @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useWifiNetworks } from "@/hooks/useWifiNetworks";
import { createTestQueryClient, createWrapper } from "@/test/query-client-wrapper";

describe("useWifiNetworks", () => {
  it("loads wifi networks from api", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            ssid: "HomeNet",
            bssid: "11:22:33:44:55:66",
            signalPercent: 65,
            channel: 1,
            frequencyMhz: 2412,
            security: "WPA/WPA2",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();
    const { result } = renderHook(() => useWifiNetworks(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/network/networks", {
      cache: "no-store",
    });
  });
});
