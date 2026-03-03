import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns healthy status payload", async () => {
    const response = await GET();
    const json = (await response.json()) as {
      ok: boolean;
      service: string;
      timestamp: string;
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.service).toBe("home-server");
    expect(json.timestamp).toBeTypeOf("string");
  });
});
