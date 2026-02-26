import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/files/trash-service", () => ({
  TrashServiceError: class TrashServiceError extends Error {
    code: string;
    statusCode: number;

    constructor(message: string, code = "internal_error", statusCode = 500) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  },
  restoreFromTrash: vi.fn(),
}));

import { POST } from "@/app/api/v1/files/trash/restore/route";
import {
  restoreFromTrash,
  TrashServiceError,
} from "@/lib/server/modules/files/trash-service";

describe("POST /api/v1/files/trash/restore", () => {
  it("restores an item from trash", async () => {
    vi.mocked(restoreFromTrash).mockResolvedValueOnce({
      restoredPath: "Documents/notes.txt",
      sourceTrashPath: "Trash/notes.txt",
    });

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: "Trash/notes.txt",
          collision: "keep-both",
        }),
      }),
    );
    const json = (await response.json()) as { data: { restoredPath: string } };

    expect(response.status).toBe(200);
    expect(json.data.restoredPath).toBe("Documents/notes.txt");
  });

  it("maps destination conflict errors", async () => {
    vi.mocked(restoreFromTrash).mockRejectedValueOnce(
      new TrashServiceError("exists", "destination_exists", 409),
    );

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: "Trash/notes.txt", collision: "fail" }),
      }),
    );
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(409);
    expect(json.code).toBe("destination_exists");
  });
});
