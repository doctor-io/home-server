"use client";

import { useCallback, useEffect, useState } from "react";

const USER_LOCATION_STORAGE_KEY = "weather.user-location.v1";

export type UserLocation = {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
};

export type UseUserLocationReturn = {
  location: UserLocation | null;
  loading: boolean;
  error: string | null;
  permissionStatus: PermissionState | null;
  requestLocation: () => void;
  setManualLocation: (location: UserLocation) => void;
};

type NominatimReverseResponse = {
  address?: {
    city?: string;
    town?: string;
    village?: string;
    country_code?: string;
  };
};

function toLocationError(error: GeolocationPositionError) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location permission denied";
    case error.POSITION_UNAVAILABLE:
      return "Location unavailable";
    case error.TIMEOUT:
      return "Location request timed out";
    default:
      return "Failed to get location";
  }
}

function toStoredLocation(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as {
      latitude?: unknown;
      longitude?: unknown;
    };
    const latitude =
      typeof parsed.latitude === "number" && Number.isFinite(parsed.latitude)
        ? parsed.latitude
        : null;
    const longitude =
      typeof parsed.longitude === "number" && Number.isFinite(parsed.longitude)
        ? parsed.longitude
        : null;
    if (latitude === null || longitude === null) return null;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return null;
    }
    const city =
      typeof parsed === "object" &&
      parsed &&
      "city" in parsed &&
      typeof (parsed as { city?: unknown }).city === "string"
        ? (parsed as { city?: string }).city
        : undefined;
    const country =
      typeof parsed === "object" &&
      parsed &&
      "country" in parsed &&
      typeof (parsed as { country?: unknown }).country === "string"
        ? (parsed as { country?: string }).country
        : undefined;

    return { latitude, longitude, city, country } satisfies UserLocation;
  } catch {
    return null;
  }
}

async function resolveCityAndCountry(location: {
  latitude: number;
  longitude: number;
}) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${location.latitude}&lon=${location.longitude}&format=json`,
      { headers: { "User-Agent": "Homeio Dashboard" } },
    );
    if (!response.ok) return { city: undefined, country: undefined };
    const json = (await response.json()) as NominatimReverseResponse;
    const city =
      json.address?.city ?? json.address?.town ?? json.address?.village;
    const country = json.address?.country_code?.toUpperCase();

    return {
      city,
      country,
    };
  } catch {
    return { city: undefined, country: undefined };
  }
}

export function useUserLocation(): UseUserLocationReturn {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<PermissionState | null>(null);

  const persistLocation = useCallback((nextLocation: UserLocation) => {
    try {
      localStorage.setItem(USER_LOCATION_STORAGE_KEY, JSON.stringify(nextLocation));
    } catch {
      // Location persistence is best-effort only.
    }
  }, []);

  const requestLocationFromBrowser = useCallback((background = false) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      if (!background) {
        setError("Geolocation not supported");
      }
      setLoading(false);
      return;
    }

    if (!background) {
      setLoading(true);
      setError(null);
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const baseLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        const { city, country } = await resolveCityAndCountry(baseLocation);
        const nextLocation = {
          ...baseLocation,
          city,
          country,
        } satisfies UserLocation;
        setLocation(nextLocation);
        persistLocation(nextLocation);
        setError(null);
        setLoading(false);
      },
      (positionError) => {
        if (!background) {
          setError(toLocationError(positionError));
        }
        setLoading(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 600_000,
      },
    );
  }, [persistLocation]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return;

    let permission: PermissionStatus | null = null;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        permission = result;
        setPermissionStatus(result.state);
        result.onchange = () => {
          setPermissionStatus(result.state);
        };
      })
      .catch(() => {
        // Permissions API support is optional.
      });

    return () => {
      if (permission) permission.onchange = null;
    };
  }, []);

  useEffect(() => {
    let savedLocation: UserLocation | null = null;
    try {
      savedLocation = toStoredLocation(
        localStorage.getItem(USER_LOCATION_STORAGE_KEY),
      );
    } catch {
      savedLocation = null;
    }

    if (savedLocation) {
      setLocation(savedLocation);
      setLoading(false);
      requestLocationFromBrowser(true);
      return;
    }

    requestLocationFromBrowser();
  }, [requestLocationFromBrowser]);

  const setManualLocation = useCallback(
    (nextLocation: UserLocation) => {
      setLocation(nextLocation);
      persistLocation(nextLocation);
      setError(null);
      setLoading(false);
    },
    [persistLocation],
  );

  return {
    location,
    loading,
    error,
    permissionStatus,
    requestLocation: () => requestLocationFromBrowser(),
    setManualLocation,
  };
}
