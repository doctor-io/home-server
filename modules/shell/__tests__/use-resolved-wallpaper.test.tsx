/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  APPEARANCE_CHANGED_EVENT,
  APPEARANCE_STORAGE_KEY,
  DEFAULT_APPEARANCE_SETTINGS,
} from "@/lib/desktop/appearance";
import { useResolvedWallpaper } from "@/modules/shell/hooks/useResolvedWallpaper";

describe("useResolvedWallpaper", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reads wallpaper from localStorage", async () => {
    localStorage.setItem(
      APPEARANCE_STORAGE_KEY,
      JSON.stringify({ wallpaper: "/images/7.jpg" }),
    );

    const { result } = renderHook(() => useResolvedWallpaper());

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    expect(result.current.wallpaper).toBe("/images/7.jpg");
  });

  it("falls back to default wallpaper", async () => {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, "{not-valid-json");

    const { result } = renderHook(() => useResolvedWallpaper());

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    expect(result.current.wallpaper).toBe(
      DEFAULT_APPEARANCE_SETTINGS.wallpaper,
    );
  });

  it("updates when the same-tab appearance event fires", async () => {
    localStorage.setItem(
      APPEARANCE_STORAGE_KEY,
      JSON.stringify({ wallpaper: "/images/2.jpg" }),
    );

    const { result } = renderHook(() => useResolvedWallpaper());

    await waitFor(() => {
      expect(result.current.wallpaper).toBe("/images/2.jpg");
    });

    await act(async () => {
      localStorage.setItem(
        APPEARANCE_STORAGE_KEY,
        JSON.stringify({ wallpaper: "/images/9.jpg" }),
      );
      window.dispatchEvent(new Event(APPEARANCE_CHANGED_EVENT));
    });

    await waitFor(() => {
      expect(result.current.wallpaper).toBe("/images/9.jpg");
    });
  });
});
