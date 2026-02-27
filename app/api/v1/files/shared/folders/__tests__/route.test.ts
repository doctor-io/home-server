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
  listLocalFolderShares: vi.fn(),
  addLocalFolderShare: vi.fn(),
}));

import { GET, POST } from "@/app/api/v1/files/shared/folders/route";
import {
  addLocalFolderShare,
  listLocalFolderShares,
  LocalSharingError,
} from "@/lib/server/modules/files/local-sharing";

describe("shared folders route", () => {
  it("GET returns shared folders list", async () => {
    vi.mocked(listLocalFolderShares).mockResolvedValueOnce([
      {
        id: "local-1",
        shareName: "Media",
        sourcePath: "Media",
        sharedPath: "Shared/Media",
        isMounted: true,
        isExported: true,
      },
    ]);

    const response = await GET();
    const json = (await response.json()) as {
      data: Array<{ id: string }>;
      meta: { count: number };
    };

    expect(response.status).toBe(200);
    expect(json.meta.count).toBe(1);
    expect(json.data[0]?.id).toBe("local-1");
  });

  it("POST validates payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/files/shared/folders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: "",
        }),
      }),
    );

    const json = (await response.json()) as { code: string };
    expect(response.status).toBe(400);
    expect(json.code).toBe("invalid_path");
  });

  it("POST maps service errors", async () => {
    vi.mocked(addLocalFolderShare).mockRejectedValueOnce(
      new LocalSharingError("exists", {
        code: "share_exists",
        statusCode: 409,
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/v1/files/shared/folders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: "Media",
        }),
      }),
    );

    const json = (await response.json()) as { code: string };
    expect(response.status).toBe(409);
    expect(json.code).toBe("share_exists");
  });
});
