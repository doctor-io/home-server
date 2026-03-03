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
  mountShare: vi.fn(),
}));

import { POST } from "@/app/api/v1/files/network/shares/[shareId]/mount/route";
import { mountShare, NetworkStorageError } from "@/lib/server/modules/files/network-storage";

describe("POST /api/v1/files/network/shares/:shareId/mount", () => {
  it("mounts a share", async () => {
    vi.mocked(mountShare).mockResolvedValueOnce({
      id: "share-1",
      host: "nas.local",
      share: "Media",
      username: "user",
      mountPath: "Network/nas.local/Media",
      isMounted: true,
    });

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ shareId: "share-1" }),
    });
    const json = (await response.json()) as { data: { isMounted: boolean } };

    expect(response.status).toBe(200);
    expect(json.data.isMounted).toBe(true);
  });

  it("maps mount failures", async () => {
    vi.mocked(mountShare).mockRejectedValueOnce(
      new NetworkStorageError("failed", "mount_failed", 500),
    );

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ shareId: "share-1" }),
    });
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(500);
    expect(json.code).toBe("mount_failed");
  });
});
