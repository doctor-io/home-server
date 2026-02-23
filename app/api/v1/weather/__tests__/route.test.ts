import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("openmeteo", () => ({
  fetchWeatherApi: vi.fn(),
}));

import { GET } from "@/app/api/v1/weather/route";
import { fetchWeatherApi } from "openmeteo";

function createOpenMeteoResponse(values: {
  temperatureC: number;
  feelsLikeC: number;
  humidityPercent: number;
  windSpeedKph: number;
  weatherCode: number;
  dailyWeatherCodes?: number[];
  dailyMaxTemps?: number[];
  dailyMinTemps?: number[];
}) {
  const dailyWeatherCodes = values.dailyWeatherCodes ?? [0, 1, 2, 3, 61, 95];
  const dailyMaxTemps = values.dailyMaxTemps ?? [20, 21, 22, 23, 24, 25];
  const dailyMinTemps = values.dailyMinTemps ?? [11, 12, 13, 14, 15, 16];

  return {
    utcOffsetSeconds: () => 0,
    current: () => ({
      variables: (index: number) => ({
        value: () =>
          [
            values.temperatureC,
            values.feelsLikeC,
            values.humidityPercent,
            values.windSpeedKph,
            values.weatherCode,
          ][index],
      }),
    }),
    daily: () => ({
      time: () => BigInt(1_735_689_600),
      interval: () => 86_400,
      variables: (index: number) => ({
        valuesArray: () =>
          Float32Array.from(
            index === 0
              ? dailyWeatherCodes
              : index === 1
                ? dailyMaxTemps
                : dailyMinTemps,
          ),
      }),
    }),
  };
}

describe("GET /api/v1/weather", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("returns weather for navigator coordinates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          address: {
            city: "Tunis",
            country: "Tunisia",
          },
        }),
      }),
    );
    vi.mocked(fetchWeatherApi).mockResolvedValueOnce([
      createOpenMeteoResponse({
        temperatureC: 21.4,
        feelsLikeC: 20.6,
        humidityPercent: 67,
        windSpeedKph: 18.5,
        weatherCode: 2,
      }) as never,
    ]);

    const response = await GET(
      new Request("http://localhost/api/v1/weather?lat=36.8&lon=10.1&source=navigator"),
    );
    const json = (await response.json()) as {
      data: {
        source: string;
        location: { label: string };
        current: { condition: string };
        dailyForecast: Array<{ condition: string }>;
      };
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(json.data.source).toBe("navigator");
    expect(json.data.location.label).toBe("Tunis");
    expect(json.data.current.condition).toBe("Partly cloudy");
    expect(json.data.dailyForecast).toHaveLength(5);
    expect(json.data.dailyForecast[0]?.condition).toBe("Mainly clear");
  });

  it("falls back when providers fail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );
    const response = await GET(new Request("http://localhost/api/v1/weather"));
    const json = (await response.json()) as {
      data: {
        location: { label: string };
        current: { temperatureC: number | null };
        dailyForecast: unknown[];
      };
    };

    expect(response.status).toBe(200);
    expect(json.data.location.label).toBe("Weather unavailable");
    expect(json.data.current.temperatureC).toBeNull();
    expect(json.data.dailyForecast).toEqual([]);
    expect(fetchWeatherApi).not.toHaveBeenCalled();
  });

  it("uses backup IP provider when primary is rate limited", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          city: "Tunis",
          country: "Tunisia",
          latitude: 36.8,
          longitude: 10.1,
        }),
      });
    vi.mocked(fetchWeatherApi).mockResolvedValueOnce([
      createOpenMeteoResponse({
        temperatureC: 22.1,
        feelsLikeC: 21.2,
        humidityPercent: 58,
        windSpeedKph: 9.3,
        weatherCode: 1,
      }) as never,
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://localhost/api/v1/weather?source=ip", {
        headers: {
          "x-forwarded-for": "198.51.100.42",
        },
      }),
    );
    const json = (await response.json()) as {
      data: {
        source: string;
        location: { label: string };
        current: { condition: string };
        dailyForecast: Array<{ condition: string }>;
      };
    };

    expect(response.status).toBe(200);
    expect(json.data.source).toBe("ip");
    expect(json.data.location.label).toBe("Tunis, Tunisia");
    expect(json.data.current.condition).toBe("Mainly clear");
    expect(json.data.dailyForecast).toHaveLength(5);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
