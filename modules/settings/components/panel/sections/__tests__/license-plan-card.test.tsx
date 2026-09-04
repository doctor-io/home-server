/* @vitest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EntitlementsSnapshot } from "@/lib/shared/contracts/licensing";
import { LicensePlanCard } from "@/modules/settings/components/panel/sections/license-plan-card";
import {
  createTestQueryClient,
  createWrapper,
} from "@/test/query-client-wrapper";

function serve(snapshot: Partial<EntitlementsSnapshot>, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
      status: ok ? 200 : 500,
      json: async () => ({
        data: {
          status: "unlicensed",
          plan: "free",
          entitlements: [],
          licensedTo: null,
          expiresAt: null,
          ...snapshot,
        },
      }),
    })),
  );
}

function renderCard() {
  return render(<LicensePlanCard />, {
    wrapper: createWrapper(createTestQueryClient()),
  });
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("LicensePlanCard", () => {
  it("says the plan is free when no licence is installed", async () => {
    serve({});
    renderCard();

    await waitFor(() => expect(screen.getByText("Free")).toBeTruthy());
    expect(screen.getByText("No licence installed")).toBeTruthy();
  });

  it("shows the plan, the licensee and what it unlocks", async () => {
    serve({
      status: "active",
      plan: "pro",
      entitlements: ["multi-server", "sso"],
      licensedTo: "Ada Lovelace",
      expiresAt: "2027-01-01T00:00:00.000Z",
    });
    renderCard();

    await waitFor(() => expect(screen.getByText("Pro")).toBeTruthy());
    expect(screen.getByText(/Licensed to Ada Lovelace/)).toBeTruthy();
    expect(
      screen.getByText(/Manage several servers from one interface/),
    ).toBeTruthy();
    expect(screen.getByText(/Single sign-on and user roles/)).toBeTruthy();
  });

  it("says a perpetual licence has no expiry", async () => {
    serve({
      status: "active",
      plan: "business",
      entitlements: [],
      licensedTo: "Ada Lovelace",
      expiresAt: null,
    });
    renderCard();

    await waitFor(() => expect(screen.getByText("Business")).toBeTruthy());
    expect(screen.getByText(/no expiry/)).toBeTruthy();
  });

  it("drops back to free and warns when the licence has expired", async () => {
    serve({
      status: "expired",
      plan: "free",
      entitlements: [],
      licensedTo: "Ada Lovelace",
      expiresAt: "2026-01-01T00:00:00.000Z",
    });
    renderCard();

    await waitFor(() => expect(screen.getByText("Free")).toBeTruthy());
    expect(screen.getByText(/Licence expired on/)).toBeTruthy();
  });

  it("warns when the licence cannot be verified", async () => {
    serve({ status: "invalid" });
    renderCard();

    await waitFor(() =>
      expect(screen.getByText(/could not be verified/)).toBeTruthy(),
    );
  });

  it("falls back to free when the request fails, never to a paid plan", async () => {
    serve({ status: "active", plan: "business" }, false);
    renderCard();

    await waitFor(() => expect(screen.getByText("Free")).toBeTruthy());
    expect(screen.queryByText("Business")).toBeNull();
  });
});
