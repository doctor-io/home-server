import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockCreateSession } = vi.hoisted(() => ({
  mockDb: {
    delete: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
  mockCreateSession: vi.fn(),
}));

vi.mock("@/lib/server/db/drizzle", () => ({ db: mockDb }));
vi.mock("@/lib/server/modules/auth/repository", () => ({
  createSession: mockCreateSession,
}));

import {
  PAIRING_CODE_TTL_MS,
  PairingError,
  claimPairingCode,
  createPairingCode,
  generatePairingCode,
} from "@/lib/server/modules/auth/pairing-service";

/** Records what the conditional UPDATE was asked to match. */
function updateReturning(rows: unknown[]) {
  const where = vi.fn(() => ({ returning: vi.fn(async () => rows) }));
  const set = vi.fn(() => ({ where }));
  mockDb.update.mockReturnValue({ set });
  return { set, where };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.delete.mockReturnValue({ where: vi.fn(async () => undefined) });
  mockDb.insert.mockReturnValue({ values: vi.fn(async () => undefined) });
  mockCreateSession.mockResolvedValue(undefined);
});

describe("generatePairingCode", () => {
  it("is long enough that guessing is not the attack to worry about", () => {
    const code = generatePairingCode();

    // 32 random bytes, base64url — 43 characters, no padding, URL safe because
    // it travels inside the QR's query string.
    expect(code).toHaveLength(43);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("does not repeat", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generatePairingCode()));
    expect(codes.size).toBe(50);
  });
});

describe("createPairingCode", () => {
  it("drops the operator's earlier unclaimed codes, so one QR is live at a time", async () => {
    await createPairingCode("user-1");

    // A second live code means a stale phone screen somewhere still opens the
    // server, which is exactly what a short TTL is meant to prevent.
    expect(mockDb.delete).toHaveBeenCalledTimes(1);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it("expires in a minute", async () => {
    const before = Date.now();
    const { expiresAt } = await createPairingCode("user-1");

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + PAIRING_CODE_TTL_MS - 50);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + PAIRING_CODE_TTL_MS);
  });

  it("never stores the code itself", async () => {
    let stored: { codeHash: string } | null = null;
    mockDb.insert.mockReturnValue({
      values: vi.fn(async (row: { codeHash: string }) => {
        stored = row;
      }),
    });

    const { code } = await createPairingCode("user-1");
    if (!stored) throw new Error("insert was never called");

    const row = stored as { codeHash: string };
    expect(row.codeHash).not.toBe(code);
    expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("claimPairingCode", () => {
  it("returns a session for the operator who minted the code", async () => {
    updateReturning([{ userId: "user-1" }]);

    const claim = await claimPairingCode("some-code", "10.0.0.5");

    expect(claim.userId).toBe("user-1");
    expect(claim.token).toContain(".");
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" }),
    );
  });

  it("spends the code in the statement that reads it", async () => {
    const { set } = updateReturning([{ userId: "user-1" }]);

    await claimPairingCode("some-code", null);

    // Two phones pointed at the same screen must not both come away with a
    // session, and only the database can settle that race — so the claim is a
    // conditional UPDATE, never a read followed by a write.
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ claimedAt: expect.any(Date) }),
    );
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  it("refuses a code the update did not match, and issues nothing", async () => {
    updateReturning([]);

    await expect(claimPairingCode("stale-code", null)).rejects.toBeInstanceOf(PairingError);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("says the same thing whether a code expired, was spent, or never existed", async () => {
    updateReturning([]);

    // Anyone holding a code they were not given learns nothing from the answer.
    const error = await claimPairingCode("x", null).catch((e: PairingError) => e);

    expect(error).toBeInstanceOf(PairingError);
    expect((error as PairingError).code).toBe("invalid_code");
    expect((error as PairingError).message).toBe("This pairing code is not valid");
  });

  it("records where a code was spent from", async () => {
    const { set } = updateReturning([{ userId: "user-1" }]);

    await claimPairingCode("some-code", "192.168.1.50");

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ claimedIp: "192.168.1.50" }),
    );
  });
});
