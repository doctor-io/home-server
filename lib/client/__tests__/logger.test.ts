import { describe, expect, it, vi } from "vitest";
import { logClientAction, withClientTiming } from "@/lib/client/logger";

describe("client logger", () => {
  it("logClientAction is a no-op", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const sendBeacon = vi.fn();
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { sendBeacon },
    });

    logClientAction({
      layer: "hook",
      action: "hooks.example.action",
      status: "info",
      level: "info",
      meta: { key: "value" },
    });

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("withClientTiming returns wrapped result unchanged", async () => {
    const result = await withClientTiming(
      {
        layer: "hook",
        action: "hooks.example.success",
      },
      async () => "ok",
    );

    expect(result).toBe("ok");
  });

  it("withClientTiming rethrows wrapped error unchanged", async () => {
    const error = new Error("boom");

    await expect(
      withClientTiming(
        {
          layer: "hook",
          action: "hooks.example.error",
        },
        async () => {
          throw error;
        },
      ),
    ).rejects.toBe(error);
  });
});
