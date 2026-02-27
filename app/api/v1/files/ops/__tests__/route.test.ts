import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/files/service", () => ({
  FileServiceError: class FileServiceError extends Error {
    code: string;
    statusCode: number;

    constructor(
      message: string,
      options?: {
        code?: string;
        statusCode?: number;
      },
    ) {
      super(message);
      this.code = options?.code ?? "internal_error";
      this.statusCode = options?.statusCode ?? 500;
    }
  },
  createDirectoryEntry: vi.fn(),
  createFileEntry: vi.fn(),
  pasteEntry: vi.fn(),
}));

import { POST } from "@/app/api/v1/files/ops/route";
import {
  createDirectoryEntry,
  createFileEntry,
  FileServiceError,
  pasteEntry,
} from "@/lib/server/modules/files/service";

describe("POST /api/v1/files/ops", () => {
  it("creates folder entries", async () => {
    vi.mocked(createDirectoryEntry).mockResolvedValueOnce({
      root: "/DATA",
      path: "Documents/New Folder",
      type: "folder",
    });

    const response = await POST(
      new Request("http://localhost/api/v1/files/ops", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "create_folder",
          parentPath: "Documents",
          name: "New Folder",
        }),
      }),
    );
    const json = (await response.json()) as { data: { path: string } };

    expect(response.status).toBe(200);
    expect(json.data.path).toBe("Documents/New Folder");
  });

  it("creates file entries", async () => {
    vi.mocked(createFileEntry).mockResolvedValueOnce({
      root: "/DATA",
      path: "Documents/notes.txt",
      type: "file",
    });

    const response = await POST(
      new Request("http://localhost/api/v1/files/ops", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "create_file",
          parentPath: "Documents",
          name: "notes.txt",
        }),
      }),
    );
    const json = (await response.json()) as { data: { type: string } };

    expect(response.status).toBe(200);
    expect(json.data.type).toBe("file");
  });

  it("pastes copied entries", async () => {
    vi.mocked(pasteEntry).mockResolvedValueOnce({
      root: "/DATA",
      path: "Documents/photo.jpg",
      type: "file",
    });

    const response = await POST(
      new Request("http://localhost/api/v1/files/ops", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "paste",
          sourcePath: "Media/photo.jpg",
          destinationPath: "Documents",
          operation: "copy",
        }),
      }),
    );
    const json = (await response.json()) as { data: { path: string } };

    expect(response.status).toBe(200);
    expect(json.data.path).toBe("Documents/photo.jpg");
  });

  it("maps service errors", async () => {
    vi.mocked(createDirectoryEntry).mockRejectedValueOnce(
      new FileServiceError("already exists", {
        code: "destination_exists",
        statusCode: 409,
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/v1/files/ops", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "create_folder",
          parentPath: "Documents",
          name: "New Folder",
        }),
      }),
    );
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(409);
    expect(json.code).toBe("destination_exists");
  });
});
