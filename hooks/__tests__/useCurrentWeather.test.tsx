/* @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCurrentWeather } from "@/hooks/useCurrentWeather";
import { createTestQueryClient, createWrapper } from "@/test/query-client-wrapper";

const mockUseUserLocation = vi.fn();

vi.mock("@/hooks/useUserLocation", () => ({
  useUserLocation: () => mockUseUserLocation(),
}));

describe("useCurrentWeather", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads weather from Open-Meteo when browser location is available", async () => {
    mockUseUserLocation.mockReturnValue({
      location: {
        latitude: 36.8,
        longitude: 10.1,
        city: "Tunis",
        country: "Tunisia",
      },
      loading: false,
      error: null,
      permissionStatus: "granted",
      requestLocation: vi.fn(),
      setManualLocation: vi.fn(),
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          current: {
            temperature_2m: 21.4,
            apparent_temperature: 20.6,
            relative_humidity_2m: 67,
            wind_speed_10m: 18.5,
            weather_code: 2,
          },
          daily: {
            time: [
              "2026-02-22",
              "2026-02-23",
              "2026-02-24",
              "2026-02-25",
              "2026-02-26",
              "2026-02-27",
            ],
            weather_code: [0, 1, 2, 3, 61, 95],
            temperature_2m_max: [20, 21, 22, 23, 24, 25],
            temperature_2m_min: [11, 12, 13, 14, 15, 16],
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

    const [weatherRequestUrl, weatherRequestInit] = vi.mocked(fetch).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const weatherUrl = new URL(weatherRequestUrl);

    expect(weatherUrl.origin + weatherUrl.pathname).toBe("https://api.open-meteo.com/v1/forecast");
    expect(weatherUrl.searchParams.get("latitude")).toBe("36.8");
    expect(weatherUrl.searchParams.get("longitude")).toBe("10.1");
    expect(weatherUrl.searchParams.get("timezone")).toBe("auto");
    expect(weatherUrl.searchParams.get("current")).toBe(
      "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code",
    );
    expect(weatherUrl.searchParams.get("daily")).toBe(
      "weather_code,temperature_2m_max,temperature_2m_min",
    );
    expect(weatherRequestInit).toEqual({
      cache: "no-store",
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(result.current.data?.source).toBe("navigator");
    expect(result.current.data?.location.label).toBe("Tunis, Tunisia");
    expect(result.current.data?.current.condition).toBe("Partly cloudy");
    expect(result.current.data?.dailyForecast).toHaveLength(5);
    expect(result.current.data?.dailyForecast[0]?.condition).toBe("Mainly clear");
  });

  it("does not fetch weather when location is unavailable", async () => {
    mockUseUserLocation.mockReturnValue({
      location: null,
      loading: false,
      error: "Location permission denied",
      permissionStatus: "denied",
      requestLocation: vi.fn(),
      setManualLocation: vi.fn(),
    });

    vi.stubGlobal("fetch", vi.fn());

    const client = createTestQueryClient();
    const { result } = renderHook(() => useCurrentWeather(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe("idle");
    });

    expect(result.current.data).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});
