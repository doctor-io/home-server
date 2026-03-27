import { describe, expect, it, vi } from "vitest";
import { closeServerGracefully } from "@/lib/server/http/graceful-shutdown";

describe("closeServerGracefully", () => {
  it("closes idle connections and resolves when the server closes cleanly", async () => {
    const closeIdleConnections = vi.fn();
    const close = vi.fn((callback: () => void) => {
      callback();
      return {} as never;
    });

    await closeServerGracefully({
      close,
      closeIdleConnections,
    });

    expect(close).toHaveBeenCalledTimes(1);
    expect(closeIdleConnections).toHaveBeenCalledTimes(1);
  });

  it("forces remaining connections closed when the shutdown timeout expires", async () => {
    vi.useFakeTimers();

    const closeIdleConnections = vi.fn();
    const closeAllConnections = vi.fn();
    const close = vi.fn(() => ({} as never));

    const shutdownPromise = closeServerGracefully(
      {
        close,
        closeIdleConnections,
        closeAllConnections,
      },
      50,
    );

    await vi.advanceTimersByTimeAsync(50);
    await shutdownPromise;

    expect(close).toHaveBeenCalledTimes(1);
    expect(closeIdleConnections).toHaveBeenCalledTimes(2);
    expect(closeAllConnections).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
