import { describe, expect, it } from "vitest";
import { toSseChunk } from "@/lib/server/realtime/sse";

describe("toSseChunk", () => {
  it("formats SSE payload with event and data", () => {
    const chunk = toSseChunk("metrics.updated", { value: 1 });

    expect(chunk).toContain("event: metrics.updated");
    expect(chunk).toContain('data: {"value":1}');
    expect(chunk.endsWith("\n\n")).toBe(true);
  });

  it("includes optional id", () => {
    const chunk = toSseChunk("heartbeat", { ok: true }, { id: "abc" });

    expect(chunk).toContain("id: abc");
  });
});
