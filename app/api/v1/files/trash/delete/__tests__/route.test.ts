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
  deleteFromTrash: vi.fn(),
}));

import { POST } from "@/app/api/v1/files/trash/delete/route";
import {
  deleteFromTrash,
  TrashServiceError,
} from "@/lib/server/modules/files/trash-service";

describe("POST /api/v1/files/trash/delete", () => {
  it("permanently deletes an item from trash", async () => {
    vi.mocked(deleteFromTrash).mockResolvedValueOnce({
      deleted: true,
      path: "Trash/notes.txt",
    });

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: "Trash/notes.txt" }),
      }),
    );
    const json = (await response.json()) as { data: { deleted: boolean } };

    expect(response.status).toBe(200);
    expect(json.data.deleted).toBe(true);
  });

  it("maps service errors", async () => {
    vi.mocked(deleteFromTrash).mockRejectedValueOnce(
      new TrashServiceError("missing", "not_found", 404),
    );

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: "Trash/missing.txt" }),
      }),
    );
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(404);
    expect(json.code).toBe("not_found");
  });
});
