/* @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useInstalledApps } from "@/hooks/useInstalledApps";
import { createTestQueryClient, createWrapper } from "@/test/query-client-wrapper";

describe("useInstalledApps", () => {
  it("loads installed apps from api", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "1",
              name: "Plex",
              status: "running",
              updatedAt: "2026-02-22T12:00:00.000Z",
            },
          ],
        }),
      }),
    );

    const client = createTestQueryClient();
    const { result } = renderHook(() => useInstalledApps(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.[0]?.name).toBe("Plex");
    expect(fetch).toHaveBeenCalledWith("/api/v1/apps", { cache: "no-store" });
  });
});
