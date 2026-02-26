import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/files/service", () => ({
  FileServiceError: class FileServiceError extends Error {
    code: string;
    statusCode: number;

    constructor(message: string, code = "internal_error", statusCode = 500) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  },
  listDirectory: vi.fn(),
}));

import { GET } from "@/app/api/v1/files/route";
import {
  FileServiceError,
  listDirectory,
} from "@/lib/server/modules/files/service";

describe("GET /api/v1/files", () => {
  it("returns directory entries", async () => {
    vi.mocked(listDirectory).mockResolvedValueOnce({
      root: "/",
      cwd: "Documents",
      entries: [
        {
          name: "notes.txt",
          path: "Documents/notes.txt",
          type: "file",
          ext: "txt",
          sizeBytes: 12,
          modifiedAt: "2026-02-26T12:00:00.000Z",
          mtimeMs: 12345,
        },
      ],
    });

    const response = await GET(
      new NextRequest("http://localhost/api/v1/files?path=Documents"),
    );
    const json = (await response.json()) as {
      data: { entries: unknown[] };
      meta: { count: number };
    };

    expect(response.status).toBe(200);
    expect(json.meta.count).toBe(1);
    expect(json.data.entries).toHaveLength(1);
    expect(vi.mocked(listDirectory)).toHaveBeenCalledWith({
      path: "Documents",
      includeHidden: false,
    });
  });

  it("returns mapped service errors", async () => {
    vi.mocked(listDirectory).mockRejectedValueOnce(
      new FileServiceError("blocked", "path_outside_root", 400),
    );

    const response = await GET(
      new NextRequest("http://localhost/api/v1/files?path=../etc"),
    );
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(json.code).toBe("path_outside_root");
  });
});
