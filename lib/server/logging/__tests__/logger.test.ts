import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("server logger", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("writes structured logs to console and file", async () => {
    process.env.NODE_ENV = "development";

    const appendFile = vi.fn(async () => undefined);
    const mkdir = vi.fn(async () => undefined);

    vi.doMock("node:fs/promises", () => ({ appendFile, mkdir }));
    vi.doMock("@/lib/server/env", () => ({
      serverEnv: {
        LOG_LEVEL: "info",
        LOG_FILE_PATH: "logs/test.log",
        LOG_TO_FILE: true,
      },
    }));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { flushServerLogsForTests, logServerAction } = await import(
      "@/lib/server/logging/logger"
    );

    logServerAction({
      layer: "api",
      action: "health.get",
      status: "success",
      meta: { requestId: "r1" },
    });

    await flushServerLogsForTests();

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(mkdir).toHaveBeenCalledTimes(1);
    expect(appendFile).toHaveBeenCalledTimes(1);
    expect(String(appendFile.mock.calls[0][1])).toContain('"action":"health.get"');
  });

  it("logs and rethrows timed operation errors", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.doMock("@/lib/server/env", () => ({
      serverEnv: {
        LOG_LEVEL: "debug",
        LOG_FILE_PATH: "logs/test.log",
        LOG_TO_FILE: false,
      },
    }));

    const { withServerTiming } = await import("@/lib/server/logging/logger");

    await expect(
      withServerTiming(
        {
          layer: "db",
          action: "pg.query",
        },
        async () => {
          throw new Error("boom");
        },
      ),
    ).rejects.toThrow("boom");

    expect(errorSpy).toHaveBeenCalled();
  });
});
