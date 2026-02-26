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
  removeShare: vi.fn(),
}));

import { DELETE } from "@/app/api/v1/files/network/shares/[shareId]/route";
import {
  NetworkStorageError,
  removeShare,
} from "@/lib/server/modules/files/network-storage";

describe("DELETE /api/v1/files/network/shares/:shareId", () => {
  it("removes the requested share", async () => {
    vi.mocked(removeShare).mockResolvedValueOnce({
      removed: true,
      id: "share-1",
    });

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({
        shareId: "share-1",
      }),
    });
    const json = (await response.json()) as { data: { removed: boolean } };

    expect(response.status).toBe(200);
    expect(json.data.removed).toBe(true);
  });

  it("maps not-found errors", async () => {
    vi.mocked(removeShare).mockRejectedValueOnce(
      new NetworkStorageError("missing", "share_not_found", 404),
    );

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({
        shareId: "missing",
      }),
    });
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(404);
    expect(json.code).toBe("share_not_found");
  });
});
