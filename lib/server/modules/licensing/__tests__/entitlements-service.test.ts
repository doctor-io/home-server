import { beforeEach, describe, expect, it, vi } from "vitest";

// hoisted: vi.mock factories are lifted above the file's own declarations.
const env = vi.hoisted(() => ({
  HOMEIO_LICENSE: undefined as string | undefined,
}));
const verifyLicenseToken = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/env", () => ({ serverEnv: env }));
vi.mock("@/lib/server/modules/licensing/license", () => ({
  verifyLicenseToken,
}));

import {
  getEntitlementsSnapshot,
  hasEntitlement,
  resetEntitlementsCache,
} from "@/lib/server/modules/licensing/entitlements-service";

const claims = {
  version: 1,
  licensee: "Ada Lovelace",
  plan: "pro" as const,
  entitlements: ["multi-server" as const],
  issuedAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2027-01-01T00:00:00.000Z",
};

describe("entitlements service", () => {
  beforeEach(() => {
    env.HOMEIO_LICENSE = undefined;
    verifyLicenseToken.mockReset();
    resetEntitlementsCache();
  });

  it("grants nothing without a licence, and does not try to verify one", () => {
    expect(getEntitlementsSnapshot()).toEqual({
      status: "unlicensed",
      plan: "free",
      entitlements: [],
      licensedTo: null,
      expiresAt: null,
    });
    expect(verifyLicenseToken).not.toHaveBeenCalled();
  });

  it("grants nothing on an unverifiable licence", () => {
    env.HOMEIO_LICENSE = "forged";
    verifyLicenseToken.mockReturnValue({ valid: false, reason: "bad-signature" });

    expect(getEntitlementsSnapshot()).toMatchObject({
      status: "invalid",
      plan: "free",
      entitlements: [],
    });
  });

  it("grants the licence's plan and entitlements while it is current", () => {
    env.HOMEIO_LICENSE = "valid";
    verifyLicenseToken.mockReturnValue({ valid: true, claims });

    expect(getEntitlementsSnapshot(new Date("2026-06-01"))).toEqual({
      status: "active",
      plan: "pro",
      entitlements: ["multi-server"],
      licensedTo: "Ada Lovelace",
      expiresAt: "2027-01-01T00:00:00.000Z",
    });
  });

  it("revokes entitlements once the licence lapses, without a restart", () => {
    env.HOMEIO_LICENSE = "valid";
    verifyLicenseToken.mockReturnValue({ valid: true, claims });

    expect(getEntitlementsSnapshot(new Date("2026-06-01")).status).toBe("active");

    const lapsed = getEntitlementsSnapshot(new Date("2027-06-01"));
    expect(lapsed).toMatchObject({
      status: "expired",
      plan: "free",
      entitlements: [],
      licensedTo: "Ada Lovelace",
    });
    // The signature was checked once; only expiry was re-evaluated.
    expect(verifyLicenseToken).toHaveBeenCalledTimes(1);
  });

  it("re-verifies when the licence token itself changes", () => {
    env.HOMEIO_LICENSE = "first";
    verifyLicenseToken.mockReturnValue({ valid: true, claims });
    getEntitlementsSnapshot(new Date("2026-06-01"));

    env.HOMEIO_LICENSE = "second";
    getEntitlementsSnapshot(new Date("2026-06-01"));

    expect(verifyLicenseToken).toHaveBeenCalledTimes(2);
  });

  it("answers hasEntitlement from the current snapshot", () => {
    env.HOMEIO_LICENSE = "valid";
    verifyLicenseToken.mockReturnValue({ valid: true, claims });

    expect(hasEntitlement("multi-server", new Date("2026-06-01"))).toBe(true);
    expect(hasEntitlement("sso", new Date("2026-06-01"))).toBe(false);
    expect(hasEntitlement("multi-server", new Date("2027-06-01"))).toBe(false);
  });
});
