"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { withClientTiming } from "@/lib/client/logger";
import type { WeatherSnapshot } from "@/lib/shared/contracts/weather";
import { queryKeys } from "@/lib/shared/query-keys";

type WeatherResponse = {
  data: WeatherSnapshot;
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

async function fetchCurrentWeather(coords: Coordinates | null) {
  const params = new URLSearchParams();
  if (coords) {
    params.set("lat", coords.latitude.toString());
    params.set("lon", coords.longitude.toString());
    params.set("source", "navigator");
  } else {
    params.set("source", "ip");
  }

  const endpoint = `/api/v1/weather?${params.toString()}`;

  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useCurrentWeather.fetch",
      meta: {
        endpoint,
        source: coords ? "navigator" : "ip",
      },
    },
    async () => {
      const response = await fetch(endpoint, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch weather (${response.status})`);
      }

      const json = (await response.json()) as WeatherResponse;
      return json.data;
    },
  );
}

export function useCurrentWeather() {
  const [coords, setCoords] = useState<Coordinates | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        setCoords(null);
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 300_000,
      },
    );
  }, []);

  return useQuery({
    queryKey: queryKeys.currentWeather(
      coords?.latitude ?? null,
      coords?.longitude ?? null,
    ),
    queryFn: () => fetchCurrentWeather(coords),
    staleTime: 300_000,
    refetchInterval: 600_000,
  });
}
