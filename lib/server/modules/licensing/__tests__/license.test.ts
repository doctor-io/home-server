import { generateKeyPairSync, sign as signPayload } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  LICENSE_VERSION,
  verifyLicenseToken,
} from "@/lib/server/modules/licensing/license";

const keyPair = generateKeyPairSync("ed25519");
const publicKeySpkiBase64 = keyPair.publicKey
  .export({ type: "spki", format: "der" })
  .toString("base64");

const otherKeyPair = generateKeyPairSync("ed25519");

type Claims = Record<string, unknown>;

function issue(claims: Claims, privateKey = keyPair.privateKey) {
  const encodedPayload = Buffer.from(JSON.stringify(claims), "utf8").toString(
    "base64url",
  );
  const signature = signPayload(
    null,
    Buffer.from(encodedPayload, "utf8"),
    privateKey,
  ).toString("base64url");

  return `${encodedPayload}.${signature}`;
}

const validClaims: Claims = {
  version: LICENSE_VERSION,
  licensee: "Ada Lovelace",
  plan: "pro",
  entitlements: ["multi-server", "sso"],
  issuedAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2027-01-01T00:00:00.000Z",
};

const verify = (token: string, now?: Date) =>
  verifyLicenseToken(token, { now, publicKeySpkiBase64 });

describe("verifyLicenseToken", () => {
  it("accepts a licence signed by the expected key", () => {
    const result = verify(issue(validClaims), new Date("2026-06-01"));

    expect(result).toMatchObject({
      valid: true,
      claims: { licensee: "Ada Lovelace", plan: "pro" },
    });
  });

  it("rejects a licence signed by another key", () => {
    const forged = issue(validClaims, otherKeyPair.privateKey);

    expect(verify(forged, new Date("2026-06-01"))).toEqual({
      valid: false,
      reason: "bad-signature",
    });
  });

  it("rejects a payload edited after signing", () => {
    const token = issue({ ...validClaims, plan: "free" });
    const [, signature] = token.split(".");
    const tampered = Buffer.from(
      JSON.stringify({ ...validClaims, plan: "business" }),
      "utf8",
    ).toString("base64url");

    expect(verify(`${tampered}.${signature}`, new Date("2026-06-01"))).toEqual({
      valid: false,
      reason: "bad-signature",
    });
  });

  it("rejects an expired licence", () => {
    expect(verify(issue(validClaims), new Date("2027-01-02"))).toEqual({
      valid: false,
      reason: "expired",
    });
  });

  it("accepts a perpetual licence", () => {
    const result = verify(
      issue({ ...validClaims, expiresAt: null }),
      new Date("2099-01-01"),
    );

    expect(result).toMatchObject({ valid: true, claims: { expiresAt: null } });
  });

  it("rejects an unsupported licence version", () => {
    expect(
      verify(issue({ ...validClaims, version: 99 }), new Date("2026-06-01")),
    ).toEqual({ valid: false, reason: "unsupported-version" });
  });

  it("rejects claims it cannot trust", () => {
    expect(
      verify(issue({ ...validClaims, plan: "enterprise" }), new Date("2026-06-01")),
    ).toEqual({ valid: false, reason: "invalid-claims" });

    expect(
      verify(issue({ ...validClaims, licensee: "  " }), new Date("2026-06-01")),
    ).toEqual({ valid: false, reason: "invalid-claims" });
  });

  it("drops entitlements it does not recognise without failing the licence", () => {
    const result = verify(
      issue({
        ...validClaims,
        entitlements: ["multi-server", "time-travel"],
      }),
      new Date("2026-06-01"),
    );

    expect(result).toMatchObject({
      valid: true,
      claims: { entitlements: ["multi-server"] },
    });
  });

  it.each([
    ["", "malformed"],
    ["no-separator", "malformed"],
    [".onlysignature", "malformed"],
    ["onlypayload.", "malformed"],
    ["a.b.c", "malformed"],
    ["notbase64!.notbase64!", "bad-signature"],
  ])("rejects %j as %s", (token, reason) => {
    expect(verify(token)).toEqual({ valid: false, reason });
  });
});
