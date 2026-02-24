/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUserLocation } from "@/hooks/useUserLocation";

const USER_LOCATION_STORAGE_KEY = "weather.user-location.v1";

function mockGeolocation(
  implementation: Geolocation["getCurrentPosition"],
) {
  const geolocation = {
    getCurrentPosition: vi.fn(implementation),
  } satisfies Pick<Geolocation, "getCurrentPosition">;

  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: geolocation,
  });

  return geolocation.getCurrentPosition;
}

function mockPermissions(state: PermissionState = "prompt") {
  const permission = {
    state,
    onchange: null,
  } as unknown as PermissionStatus;

  const permissions = {
    query: vi.fn().mockResolvedValue(permission),
  } satisfies Pick<Permissions, "query">;

  Object.defineProperty(navigator, "permissions", {
    configurable: true,
    value: permissions,
  });

  return { permission, query: permissions.query };
}

describe("useUserLocation", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads saved coordinates from localStorage", async () => {
    localStorage.setItem(
      USER_LOCATION_STORAGE_KEY,
      JSON.stringify({ latitude: 36.8, longitude: 10.1 }),
    );
    const getCurrentPosition = mockGeolocation(() => {});

    const { result } = renderHook(() => useUserLocation());

    await waitFor(() => {
      expect(result.current.location).toEqual({
        latitude: 36.8,
        longitude: 10.1,
        city: undefined,
        country: undefined,
      });
    });

    expect(result.current.loading).toBe(false);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("persists coordinates when geolocation succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          address: {
            city: "Sousse",
            country_code: "tn",
          },
        }),
      }),
    );

    mockGeolocation((success) => {
      success({
        coords: {
          latitude: 35.2,
          longitude: 9.4,
        },
      } as GeolocationPosition);
    });

    const { result } = renderHook(() => useUserLocation());

    await waitFor(() => {
      expect(result.current.location).toEqual({
        latitude: 35.2,
        longitude: 9.4,
        city: "Sousse",
        country: "TN",
      });
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://nominatim.openstreetmap.org/reverse?lat=35.2&lon=9.4&format=json",
      { headers: { "User-Agent": "Homeio Dashboard" } },
    );
    expect(result.current.error).toBeNull();
    expect(localStorage.getItem(USER_LOCATION_STORAGE_KEY)).toBe(
      JSON.stringify({
        latitude: 35.2,
        longitude: 9.4,
        city: "Sousse",
        country: "TN",
      }),
    );
  });

  it("tracks geolocation permission status changes", async () => {
    mockGeolocation(() => {});
    const { permission } = mockPermissions("prompt");

    const { result } = renderHook(() => useUserLocation());

    await waitFor(() => {
      expect(result.current.permissionStatus).toBe("prompt");
    });

    act(() => {
      (permission as { state: PermissionState }).state = "granted";
      permission.onchange?.(new Event("change"));
    });

    await waitFor(() => {
      expect(result.current.permissionStatus).toBe("granted");
    });
  });

  it("handles missing browser geolocation support", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: undefined,
    });

    const { result } = renderHook(() => useUserLocation());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.location).toBeNull();
    expect(result.current.error).toBe("Geolocation not supported");
  });
});
