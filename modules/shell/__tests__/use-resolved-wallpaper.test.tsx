/* @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_APPEARANCE_SETTINGS } from "@/lib/desktop/appearance";
import { useResolvedWallpaper } from "@/modules/shell/hooks/useResolvedWallpaper";

describe("useResolvedWallpaper", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("reads wallpaper from API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { wallpaper: "/images/7.jpg" } }), { status: 200 }),
    );

    const { result } = renderHook(() => useResolvedWallpaper());

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    expect(result.current.wallpaper).toBe("/images/7.jpg");
  });

  it("falls back to default wallpaper when API fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useResolvedWallpaper());

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    expect(result.current.wallpaper).toBe(DEFAULT_APPEARANCE_SETTINGS.wallpaper);
  });

  it("falls back to default on invalid API response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { wallpaper: "/invalid/path.jpg" } }), { status: 200 }),
    );

    const { result } = renderHook(() => useResolvedWallpaper());

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    expect(result.current.wallpaper).toBe(DEFAULT_APPEARANCE_SETTINGS.wallpaper);
  });
});
