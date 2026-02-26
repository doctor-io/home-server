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
  getShareInfo: vi.fn(),
  addShare: vi.fn(),
}));

import { GET, POST } from "@/app/api/v1/files/network/shares/route";
import {
  addShare,
  getShareInfo,
  NetworkStorageError,
} from "@/lib/server/modules/files/network-storage";

describe("network shares route", () => {
  it("GET returns network shares list", async () => {
    vi.mocked(getShareInfo).mockResolvedValueOnce([
      {
        id: "share-1",
        host: "nas.local",
        share: "Media",
        username: "user",
        mountPath: "Network/nas.local/Media",
        isMounted: true,
      },
    ]);

    const response = await GET();
    const json = (await response.json()) as {
      data: Array<{ id: string }>;
      meta: { count: number };
    };

    expect(response.status).toBe(200);
    expect(json.meta.count).toBe(1);
    expect(json.data[0]?.id).toBe("share-1");
  });

  it("POST validates payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/files/network/shares", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          host: "",
          share: "Media",
          username: "user",
          password: "secret",
        }),
      }),
    );

    const json = (await response.json()) as { code: string };
    expect(response.status).toBe(400);
    expect(json.code).toBe("invalid_path");
  });

  it("POST maps service errors", async () => {
    vi.mocked(addShare).mockRejectedValueOnce(
      new NetworkStorageError("exists", "share_exists", 409),
    );

    const response = await POST(
      new Request("http://localhost/api/v1/files/network/shares", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          host: "nas.local",
          share: "Media",
          username: "user",
          password: "secret",
        }),
      }),
    );

    const json = (await response.json()) as { code: string };
    expect(response.status).toBe(409);
    expect(json.code).toBe("share_exists");
  });
});
