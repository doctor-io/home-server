import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/files/local-sharing", () => ({
  LocalSharingError: class LocalSharingError extends Error {
    code: string;
    statusCode: number;

    constructor(
      message: string,
      options?:
        | {
            code?: string;
            statusCode?: number;
          }
        | string,
      statusCode?: number,
    ) {
      super(message);
      if (typeof options === "string") {
        this.code = options;
        this.statusCode = statusCode ?? 500;
        return;
      }
      this.code = options?.code ?? "internal_error";
      this.statusCode = options?.statusCode ?? 500;
    }
  },
  removeLocalFolderShare: vi.fn(),
}));

import { DELETE } from "@/app/api/v1/files/shared/folders/[shareId]/route";
import {
  LocalSharingError,
  removeLocalFolderShare,
} from "@/lib/server/modules/files/local-sharing";

describe("DELETE /api/v1/files/shared/folders/:shareId", () => {
  it("removes the requested shared folder", async () => {
    vi.mocked(removeLocalFolderShare).mockResolvedValueOnce({
      removed: true,
      id: "local-1",
    });

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({
        shareId: "local-1",
      }),
    });
    const json = (await response.json()) as { data: { removed: boolean } };

    expect(response.status).toBe(200);
    expect(json.data.removed).toBe(true);
  });

  it("maps not-found errors", async () => {
    vi.mocked(removeLocalFolderShare).mockRejectedValueOnce(
      new LocalSharingError("missing", {
        code: "share_not_found",
        statusCode: 404,
      }),
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

  it("maps permission errors", async () => {
    vi.mocked(removeLocalFolderShare).mockRejectedValueOnce(
      new LocalSharingError("denied", {
        code: "permission_denied",
        statusCode: 403,
      }),
    );

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({
        shareId: "local-1",
      }),
    });
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(403);
    expect(json.code).toBe("permission_denied");
  });
});
