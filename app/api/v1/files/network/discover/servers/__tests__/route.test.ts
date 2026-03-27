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
  discoverServers: vi.fn(),
}));

import { GET } from "@/app/api/v1/files/network/discover/servers/route";
import {
  discoverServers,
  NetworkStorageError,
} from "@/lib/server/modules/files/network-storage";

describe("GET /api/v1/files/network/discover/servers", () => {
  it("returns discovered smb servers", async () => {
    vi.mocked(discoverServers).mockResolvedValueOnce({
      servers: ["nas.local"],
    });

    const response = await GET();
    const json = (await response.json()) as { data: { servers: string[] } };

    expect(response.status).toBe(200);
    expect(json.data.servers).toEqual(["nas.local"]);
  });

  it("maps service errors", async () => {
    vi.mocked(discoverServers).mockRejectedValueOnce(
      new NetworkStorageError("failed", "internal_error", 500),
    );

    const response = await GET();
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(500);
    expect(json.code).toBe("internal_error");
  });
});
