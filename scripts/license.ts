/**
 * Licence tooling for whoever issues Homeio licences.
 *
 *   npx tsx scripts/license.ts keygen
 *   npx tsx scripts/license.ts issue --licensee "Ada" --plan pro \
 *     --entitlements multi-server,sso --expires 2027-01-01
 *
 * `issue` reads the signing key from HOMEIO_LICENSE_PRIVATE_KEY (base64 of a
 * pkcs8 DER Ed25519 key, as printed by `keygen`). The private key is never
 * read from, or written to, this repository — keep it offline.
 */
import {
  createPrivateKey,
  generateKeyPairSync,
  sign as signPayload,
} from "node:crypto";

import {
  ENTITLEMENTS,
  LICENSE_PLANS,
  isEntitlement,
  isLicensePlan,
} from "../lib/shared/contracts/licensing";

const LICENSE_VERSION = 1;

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function keygen() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");

  console.log(
    "\nPublic key — paste into LICENSE_PUBLIC_KEY_SPKI_BASE64 in\n" +
      "lib/server/modules/licensing/license.ts:\n",
  );
  console.log(publicKey.export({ type: "spki", format: "der" }).toString("base64"));
  console.log(
    "\nPrivate key — store offline, never commit it, never put it on the\n" +
      "server that checks licences:\n",
  );
  console.log(
    privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"),
  );
  console.log();
}

function issue() {
  const secret = process.env.HOMEIO_LICENSE_PRIVATE_KEY;
  if (!secret) fail("HOMEIO_LICENSE_PRIVATE_KEY is not set");

  const licensee = readFlag("licensee");
  if (!licensee?.trim()) fail("--licensee is required");

  const plan = readFlag("plan") ?? "pro";
  if (!isLicensePlan(plan)) {
    fail(`--plan must be one of: ${LICENSE_PLANS.join(", ")}`);
  }

  const entitlements = (readFlag("entitlements") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const unknown = entitlements.filter((value) => !isEntitlement(value));
  if (unknown.length > 0) {
    fail(
      `unknown entitlements: ${unknown.join(", ")}\n` +
        `known: ${ENTITLEMENTS.join(", ")}`,
    );
  }

  const expires = readFlag("expires");
  if (expires && Number.isNaN(Date.parse(expires))) {
    fail("--expires must be a date, e.g. 2027-01-01");
  }

  const payload = Buffer.from(
    JSON.stringify({
      version: LICENSE_VERSION,
      licensee: licensee.trim(),
      plan,
      entitlements,
      issuedAt: new Date().toISOString(),
      expiresAt: expires ? new Date(expires).toISOString() : null,
    }),
    "utf8",
  ).toString("base64url");

  const privateKey = createPrivateKey({
    key: Buffer.from(secret, "base64"),
    format: "der",
    type: "pkcs8",
  });
  const signature = signPayload(
    null,
    Buffer.from(payload, "utf8"),
    privateKey,
  ).toString("base64url");

  console.log(`${payload}.${signature}`);
}

const command = process.argv[2];
if (command === "keygen") {
  keygen();
} else if (command === "issue") {
  issue();
} else {
  fail("usage: license.ts <keygen|issue> [flags]");
}
