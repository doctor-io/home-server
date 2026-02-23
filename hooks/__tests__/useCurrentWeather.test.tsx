/* @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCurrentWeather } from "@/hooks/useCurrentWeather";
import { createTestQueryClient, createWrapper } from "@/test/query-client-wrapper";

describe("useCurrentWeather", () => {
  it("loads weather with ip fallback when geolocation is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            timestamp: "2026-02-22T12:00:00.000Z",
            source: "ip",
            location: {
              label: "Tunis, Tunisia",
              latitude: 36.8,
              longitude: 10.1,
            },
            current: {
              temperatureC: 21.4,
              feelsLikeC: 20.6,
              humidityPercent: 67,
              windSpeedKph: 18.5,
              weatherCode: 2,
              condition: "Partly cloudy",
            },
            dailyForecast: [
              {
                date: "2026-02-23",
                weatherCode: 2,
                condition: "Partly cloudy",
                tempMaxC: 22,
                tempMinC: 14,
              },
            ],
          },
        }),
      }),
    );

    const client = createTestQueryClient();
    const { result } = renderHook(() => useCurrentWeather(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.source).toBe("ip");
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("source=ip"), {
      cache: "no-store",
    });
  });
});
