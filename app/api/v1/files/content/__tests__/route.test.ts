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
  readFileForViewer: vi.fn(),
  writeTextFile: vi.fn(),
}));

import { GET, PUT } from "@/app/api/v1/files/content/route";
import {
  FileServiceError,
  readFileForViewer,
  writeTextFile,
} from "@/lib/server/modules/files/service";

describe("GET /api/v1/files/content", () => {
  it("requires a path query parameter", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/v1/files/content"),
    );
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(json.code).toBe("invalid_path");
  });

  it("returns file content payload", async () => {
    vi.mocked(readFileForViewer).mockResolvedValueOnce({
      root: "/",
      path: "Documents/notes.txt",
      name: "notes.txt",
      ext: "txt",
      mode: "text",
      mimeType: "text/plain; charset=utf-8",
      sizeBytes: 5,
      modifiedAt: "2026-02-26T12:00:00.000Z",
      mtimeMs: 222,
      content: "hello",
    });

    const response = await GET(
      new NextRequest("http://localhost/api/v1/files/content?path=Documents/notes.txt"),
    );
    const json = (await response.json()) as { data: { mode: string } };

    expect(response.status).toBe(200);
    expect(json.data.mode).toBe("text");
    expect(vi.mocked(readFileForViewer)).toHaveBeenCalledWith({
      path: "Documents/notes.txt",
    });
  });

  it("maps service errors", async () => {
    vi.mocked(readFileForViewer).mockRejectedValueOnce(
      new FileServiceError("blocked", "hidden_blocked", 403),
    );

    const response = await GET(
      new NextRequest("http://localhost/api/v1/files/content?path=.env"),
    );
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(403);
    expect(json.code).toBe("hidden_blocked");
  });
});

describe("PUT /api/v1/files/content", () => {
  it("validates write payload", async () => {
    const response = await PUT(
      new Request("http://localhost/api/v1/files/content", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: "",
          content: "x",
        }),
      }),
    );
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(json.code).toBe("invalid_path");
  });

  it("writes text file and returns metadata", async () => {
    vi.mocked(writeTextFile).mockResolvedValueOnce({
      root: "/",
      path: "Documents/notes.txt",
      sizeBytes: 12,
      modifiedAt: "2026-02-26T12:00:00.000Z",
      mtimeMs: 555,
    });

    const response = await PUT(
      new Request("http://localhost/api/v1/files/content", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: "Documents/notes.txt",
          content: "updated",
          expectedMtimeMs: 123,
        }),
      }),
    );
    const json = (await response.json()) as { data: { path: string } };

    expect(response.status).toBe(200);
    expect(json.data.path).toBe("Documents/notes.txt");
  });
});
