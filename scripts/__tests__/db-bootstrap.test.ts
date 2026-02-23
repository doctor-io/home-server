import { describe, expect, it, vi } from "vitest";
import {
  applyInitSchema,
  ensurePrincipalUser,
  normalizeUsername,
} from "@/scripts/db-bootstrap.mjs";

describe("db bootstrap", () => {
  it("normalizes usernames", () => {
    expect(normalizeUsername("  Admin_User ")).toBe("admin_user");
  });

  it("applies init schema in a transaction", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0 });
    const client = { query };

    await applyInitSchema(client, "CREATE TABLE demo(id INT);");

    expect(query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(query).toHaveBeenNthCalledWith(2, "CREATE TABLE demo(id INT);");
    expect(query).toHaveBeenNthCalledWith(3, "COMMIT");
  });

  it("rolls back init schema when SQL fails", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockRejectedValueOnce(new Error("bad sql"))
      .mockResolvedValueOnce({ rowCount: 0 });
    const client = { query };

    await expect(applyInitSchema(client, "BROKEN SQL")).rejects.toThrow("bad sql");
    expect(query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(query).toHaveBeenNthCalledWith(2, "BROKEN SQL");
    expect(query).toHaveBeenNthCalledWith(3, "ROLLBACK");
  });

  it("returns existing principal user without insert", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "u1" }] });
    const client = { query };
    const logger = { info: vi.fn() };

    const result = await ensurePrincipalUser(client, {
      username: "admin",
      password: undefined,
      logger,
    });

    expect(result).toEqual({ created: false, username: "admin" });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("skips principal creation if password is missing", async () => {
    const query = vi.fn().mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const client = { query };
    const logger = { info: vi.fn() };

    const result = await ensurePrincipalUser(client, {
      username: "admin",
      password: undefined,
      logger,
    });

    expect(result).toEqual({
      created: false,
      username: "admin",
      skipped: true,
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("creates principal user when missing", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1 });
    const client = { query };
    const logger = { info: vi.fn() };

    const result = await ensurePrincipalUser(client, {
      username: "Admin",
      password: "StrongPass123",
      logger,
    });

    expect(result.created).toBe(true);
    expect(result.username).toBe("admin");
    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenNthCalledWith(
      1,
      "SELECT id FROM users WHERE username = $1 LIMIT 1",
      ["admin"],
    );

    const insertCall = query.mock.calls[1];
    expect(insertCall[0]).toContain("INSERT INTO users");
    expect(insertCall[1][1]).toBe("admin");
    expect(insertCall[1][2]).toMatch(/^[a-f0-9]{32}:[a-f0-9]{128}$/);
  });
});
