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
  moveToTrash: vi.fn(),
}));

import { POST } from "@/app/api/v1/files/trash/move/route";
import { moveToTrash, TrashServiceError } from "@/lib/server/modules/files/trash-service";

describe("POST /api/v1/files/trash/move", () => {
  it("moves an item to trash", async () => {
    vi.mocked(moveToTrash).mockResolvedValueOnce({
      trashPath: "Trash/notes.txt",
      originalPath: "Documents/notes.txt",
    });

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: "Documents/notes.txt" }),
      }),
    );
    const json = (await response.json()) as { data: { trashPath: string } };

    expect(response.status).toBe(200);
    expect(json.data.trashPath).toBe("Trash/notes.txt");
  });

  it("maps service errors", async () => {
    vi.mocked(moveToTrash).mockRejectedValueOnce(
      new TrashServiceError("blocked", "hidden_blocked", 403),
    );

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: "Documents/.env" }),
      }),
    );
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(403);
    expect(json.code).toBe("hidden_blocked");
  });
});
