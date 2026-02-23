import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { fetchWeatherApi } from "openmeteo";
import type {
  WeatherForecastDay,
  WeatherSnapshot,
  WeatherSource,
} from "@/lib/shared/contracts/weather";
import { NextResponse } from "next/server";

type IpApiResponse = {
  ip?: string;
  city?: string;
  country_name?: string;
  latitude?: number;
  longitude?: number;
};

type IpWhoIsResponse = {
  success?: boolean;
  message?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
};

type IpApiComResponse = {
  status?: "success" | "fail";
  message?: string;
  city?: string;
  country?: string;
  lat?: number;
  lon?: number;
};

type ReverseGeocodeResponse = {
  name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
  };
};

export const runtime = "nodejs";
const IP_LOCATION_CACHE_TTL_MS = 10 * 60 * 1000;
const ipLocationCache = new Map<
  string,
  {
    expiresAt: number;
    value: { latitude: number; longitude: number; label: string };
  }
>();

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toRounded(value: number | null, precision = 1) {
  if (value === null) return null;
  return Number(value.toFixed(precision));
}

function toNumberFromString(value: string | null) {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeIp(value: string | null) {
  if (!value) return null;
  const first = value.split(",")[0]?.trim() ?? "";
  if (!first) return null;
  if (first.startsWith("::ffff:")) return first.slice(7);
  return first;
}

function mapWeatherCodeToCondition(code: number | null) {
  if (code === null) return "Unknown";
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code === 85 || code === 86) return "Snow showers";
  if (code === 95) return "Thunderstorm";
  if (code === 96 || code === 99) return "Thunderstorm with hail";
  return "Unknown";
}

function formatForecastDate(
  dailyStartEpochSeconds: number,
  intervalSeconds: number,
  utcOffsetSeconds: number,
  index: number,
) {
  return new Date(
    (dailyStartEpochSeconds + utcOffsetSeconds + intervalSeconds * index) * 1000,
  )
    .toISOString()
    .slice(0, 10);
}

function buildDailyForecast(
  weatherResponse: Awaited<ReturnType<typeof fetchWeatherApi>>[number] | undefined,
) {
  const daily = weatherResponse?.daily();
  if (!daily) return [] as WeatherForecastDay[];

  const dailyStartEpochSeconds = Number(daily.time());
  const intervalSeconds = daily.interval();
  const utcOffsetSeconds = weatherResponse?.utcOffsetSeconds() ?? 0;

  const weatherCodes = daily.variables(0)?.valuesArray() ?? null;
  const maxTemps = daily.variables(1)?.valuesArray() ?? null;
  const minTemps = daily.variables(2)?.valuesArray() ?? null;
  const entriesCount = Math.min(
    weatherCodes?.length ?? 0,
    maxTemps?.length ?? 0,
    minTemps?.length ?? 0,
  );
  if (entriesCount <= 0) return [] as WeatherForecastDay[];

  const startIndex = entriesCount > 5 ? 1 : 0;
  const endExclusive = Math.min(startIndex + 5, entriesCount);
  const forecast: WeatherForecastDay[] = [];
  for (let index = startIndex; index < endExclusive; index += 1) {
    const weatherCode = toNumber(weatherCodes?.[index]);
    forecast.push({
      date: formatForecastDate(
        dailyStartEpochSeconds,
        intervalSeconds,
        utcOffsetSeconds,
        index,
      ),
      weatherCode,
      condition: mapWeatherCodeToCondition(weatherCode),
      tempMaxC: toRounded(toNumber(maxTemps?.[index]), 1),
      tempMinC: toRounded(toNumber(minTemps?.[index]), 1),
    });
  }

  return forecast;
}

function createFallbackSnapshot(
  source: WeatherSource,
  locationLabel = "Weather unavailable",
): WeatherSnapshot {
  return {
    timestamp: new Date().toISOString(),
    source,
    location: {
      label: locationLabel,
      latitude: null,
      longitude: null,
    },
    current: {
      temperatureC: null,
      feelsLikeC: null,
      humidityPercent: null,
      windSpeedKph: null,
      weatherCode: null,
      condition: "Unknown",
    },
    dailyForecast: [],
  };
}

async function fetchJson<T>(url: string) {
  const response = await fetch(
    url,
    {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return (await response.json()) as T;
}

async function resolveNavigatorLabel(latitude: number, longitude: number) {
  try {
    const lat = encodeURIComponent(latitude.toString());
    const lon = encodeURIComponent(longitude.toString());
    const reverse = await fetchJson<ReverseGeocodeResponse>(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
    );
    const cityLike =
      reverse.address?.city ??
      reverse.address?.town ??
      reverse.address?.village ??
      reverse.address?.municipality ??
      reverse.address?.county ??
      reverse.address?.state ??
      null;

    if (cityLike) {
      return cityLike;
    }

    return reverse.name ?? null;
  } catch (error) {
    logServerAction({
      level: "warn",
      layer: "api",
      action: "weather.location.navigator.reverseGeocode",
      status: "error",
      error,
      message:
        "Reverse geocoding failed for navigator coordinates; using fallback label",
    });
    return null;
  }
}

async function resolveLocationByNavigatorCoords(latitude: number, longitude: number) {
  const label = (await resolveNavigatorLabel(latitude, longitude)) ?? "Current location";
  return {
    latitude,
    longitude,
    label,
  };
}

function trimIpLocationCache() {
  if (ipLocationCache.size <= 128) return;

  for (const [key, value] of ipLocationCache.entries()) {
    if (value.expiresAt <= Date.now()) {
      ipLocationCache.delete(key);
    }
  }

  if (ipLocationCache.size <= 128) return;

  const oldestKey = ipLocationCache.keys().next().value;
  if (typeof oldestKey === "string") ipLocationCache.delete(oldestKey);
}

function cacheIpLocation(
  key: string,
  value: { latitude: number; longitude: number; label: string },
) {
  trimIpLocationCache();
  ipLocationCache.set(key, {
    value,
    expiresAt: Date.now() + IP_LOCATION_CACHE_TTL_MS,
  });
}

async function resolveLocationByIp(request: Request) {
  const ip =
    normalizeIp(request.headers.get("x-forwarded-for")) ??
    normalizeIp(request.headers.get("x-real-ip"));
  const normalizedIp =
    ip && ip !== "127.0.0.1" && ip !== "::1" ? encodeURIComponent(ip) : "";
  const cacheKey = normalizedIp || "auto";

  const cachedLocation = ipLocationCache.get(cacheKey);
  if (cachedLocation && cachedLocation.expiresAt > Date.now()) {
    return cachedLocation.value;
  }

  const headerLatitude = toNumberFromString(
    request.headers.get("x-vercel-ip-latitude"),
  );
  const headerLongitude = toNumberFromString(
    request.headers.get("x-vercel-ip-longitude"),
  );
  if (headerLatitude !== null && headerLongitude !== null) {
    const location = {
      latitude: headerLatitude,
      longitude: headerLongitude,
      label:
        [
          request.headers.get("x-vercel-ip-city"),
          request.headers.get("x-vercel-ip-country"),
        ]
          .filter((part): part is string => Boolean(part))
          .join(", ") || "IP location",
    };
    cacheIpLocation(cacheKey, location);
    return location;
  }

  const providers = [
    {
      name: "ipapi",
      url: `https://ipapi.co/${normalizedIp ? `${normalizedIp}/` : ""}json/`,
      map: (data: IpApiResponse) => ({
        latitude: toNumber(data.latitude),
        longitude: toNumber(data.longitude),
        label:
          [data.city, data.country_name].filter(Boolean).join(", ") ||
          "IP location",
      }),
    },
    {
      name: "ipwhois",
      url: `https://ipwho.is/${normalizedIp}`,
      map: (data: IpWhoIsResponse) => {
        if (data.success === false) {
          throw new Error(data.message || "ipwho.is lookup failed");
        }

        return {
          latitude: toNumber(data.latitude),
          longitude: toNumber(data.longitude),
          label:
            [data.city, data.country].filter(Boolean).join(", ") ||
            "IP location",
        };
      },
    },
    {
      name: "ip-api",
      url: `http://ip-api.com/json/${normalizedIp}`,
      map: (data: IpApiComResponse) => {
        if (data.status === "fail") {
          throw new Error(data.message || "ip-api lookup failed");
        }

        return {
          latitude: toNumber(data.lat),
          longitude: toNumber(data.lon),
          label:
            [data.city, data.country].filter(Boolean).join(", ") ||
            "IP location",
        };
      },
    },
  ] as const;

  for (const provider of providers) {
    try {
      const payload = await fetchJson(provider.url);
      const mapped = provider.map(payload as never);
      if (mapped.latitude === null || mapped.longitude === null) {
        throw new Error(`${provider.name} did not include coordinates`);
      }

      const location = {
        latitude: mapped.latitude,
        longitude: mapped.longitude,
        label: mapped.label,
      };
      cacheIpLocation(cacheKey, location);
      return location;
    } catch (error) {
      logServerAction({
        level: "warn",
        layer: "api",
        action: `weather.location.ip.${provider.name}`,
        status: "error",
        error,
        message: "IP geolocation provider failed; trying next provider",
      });
    }
  }

  throw new Error("IP location did not include coordinates");
}

async function fetchCurrentWeather(
  source: WeatherSource,
  latitude: number,
  longitude: number,
  locationLabel: string,
) {
  const responses = await fetchWeatherApi("https://api.open-meteo.com/v1/forecast", {
    latitude: [latitude],
    longitude: [longitude],
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
  });
  const firstResponse = responses[0];
  const current = firstResponse?.current();
  if (!current) {
    throw new Error("Open-Meteo response missing current weather data");
  }

  const weatherCode = toNumber(current.variables(4)?.value());

  return {
    timestamp: new Date().toISOString(),
    source,
    location: {
      label: locationLabel,
      latitude: toRounded(latitude, 4),
      longitude: toRounded(longitude, 4),
    },
    current: {
      temperatureC: toRounded(toNumber(current.variables(0)?.value()), 1),
      feelsLikeC: toRounded(toNumber(current.variables(1)?.value()), 1),
      humidityPercent: toRounded(
        toNumber(current.variables(2)?.value()),
        0,
      ),
      windSpeedKph: toRounded(toNumber(current.variables(3)?.value()), 1),
      weatherCode,
      condition: mapWeatherCodeToCondition(weatherCode),
    },
    dailyForecast: buildDailyForecast(firstResponse),
  } satisfies WeatherSnapshot;
}

export async function GET(request: Request) {
  const requestId = createRequestId();

  return withServerTiming(
    {
      layer: "api",
      action: "weather.current",
      requestId,
    },
    async () => {
      const { searchParams } = new URL(request.url);
      const latParam = searchParams.get("lat");
      const lonParam = searchParams.get("lon");
      const sourceParam = searchParams.get("source");
      const source: WeatherSource =
        sourceParam === "navigator" ? "navigator" : "ip";

      try {
        const hasNavigatorCoords = latParam !== null && lonParam !== null;
        const location = hasNavigatorCoords
          ? await (async () => {
              const latitude = Number.parseFloat(latParam);
              const longitude = Number.parseFloat(lonParam);

              if (
                !Number.isFinite(latitude) ||
                !Number.isFinite(longitude) ||
                latitude < -90 ||
                latitude > 90 ||
                longitude < -180 ||
                longitude > 180
              ) {
                throw new Error("Invalid navigator coordinates");
              }

              return resolveLocationByNavigatorCoords(latitude, longitude);
            })()
          : await resolveLocationByIp(request);

        const snapshot = await fetchCurrentWeather(
          hasNavigatorCoords ? "navigator" : source,
          location.latitude,
          location.longitude,
          location.label,
        );

        return NextResponse.json(
          { data: snapshot },
          {
            headers: {
              "Cache-Control": "no-store",
            },
          },
        );
      } catch (error) {
        logServerAction({
          level: "warn",
          layer: "api",
          action: "weather.current",
          status: "error",
          requestId,
          error,
          message: "Weather fallback used",
        });

        return NextResponse.json(
          { data: createFallbackSnapshot(source) },
          {
            headers: {
              "Cache-Control": "no-store",
            },
          },
        );
      }
    },
  );
}
