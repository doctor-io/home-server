import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/files/network-storage", () => ({
  NetworkStorageError: class NetworkStorageError extends Error {
    code: string;
    statusCode: number;

    constructor(message: string, code = "internal_error", statusCode = 500) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  },
  startNetworkStorageWatcher: vi.fn(),
  discoverShares: vi.fn(),
}));

import { POST } from "@/app/api/v1/files/network/discover/shares/route";
import {
  discoverShares,
  NetworkStorageError,
} from "@/lib/server/modules/files/network-storage";

describe("POST /api/v1/files/network/discover/shares", () => {
  it("validates payload", async () => {
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          host: "",
          username: "user",
          password: "secret",
        }),
      }),
    );
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(json.code).toBe("invalid_path");
  });

  it("returns discovered shares", async () => {
    vi.mocked(discoverShares).mockResolvedValueOnce({
      shares: ["Media", "Backups"],
    });

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          host: "nas.local",
          username: "user",
          password: "secret",
        }),
      }),
    );
    const json = (await response.json()) as { data: { shares: string[] } };

    expect(response.status).toBe(200);
    expect(json.data.shares).toEqual(["Media", "Backups"]);
  });

  it("maps service errors", async () => {
    vi.mocked(discoverShares).mockRejectedValueOnce(
      new NetworkStorageError("failed", "internal_error", 500),
    );

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          host: "nas.local",
          username: "user",
          password: "secret",
        }),
      }),
    );
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(500);
    expect(json.code).toBe("internal_error");
  });
});
