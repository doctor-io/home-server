import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "@/components/desktop/status-bar/utils";

describe("status bar utils", () => {
  it("formats recent timestamps in seconds", () => {
    const now = new Date("2026-02-22T23:45:00.000Z");
    const value = formatRelativeTime("2026-02-22T23:44:45.000Z", now);

    expect(value).toBe("15s ago");
  });

  it("formats older timestamps in minutes", () => {
    const now = new Date("2026-02-22T23:45:00.000Z");
    const value = formatRelativeTime("2026-02-22T23:42:00.000Z", now);

    expect(value).toBe("3 min ago");
  });
});
