/* @vitest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UpdateRecoveryScreen } from "@/modules/shell/components/update-recovery-screen";
import { createTestQueryClient, createWrapper } from "@/test/query-client-wrapper";

const routerReplaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplaceMock,
  }),
}));

vi.mock("@/lib/desktop/browser-reload", () => ({
  reloadBrowserWindow: vi.fn(),
}));

describe("UpdateRecoveryScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("tracks recovery without dispatching a second update request", async () => {
    localStorage.setItem(
      "system.power.action.v1",
      JSON.stringify({
        action: "update",
        startedAt: new Date("2026-03-11T22:00:00.000Z").toISOString(),
        requestDispatchedAt: new Date("2026-03-11T22:00:01.000Z").toISOString(),
      }),
    );

    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      return {
        ok: url === "/api/health" ? false : true,
        status: url === "/api/health" ? 502 : 200,
        json: async () => ({ data: { ok: true } }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<UpdateRecoveryScreen />, { wrapper: createWrapper(createTestQueryClient()) });

    await waitFor(() => {
      expect(screen.getByTestId("full-screen-shell")).toBeTruthy();
      expect(fetchMock).toHaveBeenCalledWith("/api/health", {
        cache: "no-store",
      });
      expect(
        JSON.parse(localStorage.getItem("system.power.action.v1") ?? "{}"),
      ).toMatchObject({
        action: "update",
      });
    });

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/v1/system/updates/apply",
      expect.anything(),
    );
  });

  it("redirects home when there is no active update state", async () => {
    render(<UpdateRecoveryScreen />, { wrapper: createWrapper(createTestQueryClient()) });

    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith("/");
    });
  });
});
