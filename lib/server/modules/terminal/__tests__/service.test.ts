import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

import {
  executeTerminalCommand,
} from "@/lib/server/modules/terminal/service";

function createMockChildProcess() {
  const processEvents = new EventEmitter();
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();

  return Object.assign(processEvents, {
    stdout,
    stderr,
    kill: vi.fn(),
  });
}

describe("terminal service", () => {
  it("returns builtin help output", async () => {
    const result = await executeTerminalCommand({
      command: "help",
    });

    expect(result.exitCode).toBe(0);
    expect(result.lines[0]?.content).toContain("Supported commands");
  });

  it("rejects forbidden commands", async () => {
    await expect(
      executeTerminalCommand({
        command: "bash",
      }),
    ).rejects.toMatchObject({
      code: "forbidden_command",
      statusCode: 403,
    });
  });

  it("executes external allowed commands", async () => {
    spawnMock.mockImplementationOnce(() => {
      const child = createMockChildProcess();
      queueMicrotask(() => {
        child.stdout.emit("data", Buffer.from("hello from command\n"));
        child.emit("close", 0);
      });
      return child;
    });

    const result = await executeTerminalCommand({
      command: "echo hello",
      cwd: process.cwd(),
    });

    expect(spawnMock).toHaveBeenCalledWith("echo", ["hello"], expect.any(Object));
    expect(result.lines[0]).toMatchObject({
      type: "output",
    });
    expect(result.lines[0]?.content).toContain("hello from command");
  });

  it("maps ENOENT errors to command_not_found", async () => {
    spawnMock.mockImplementationOnce(() => {
      const child = createMockChildProcess();
      queueMicrotask(() => {
        const error = Object.assign(new Error("missing"), {
          code: "ENOENT",
        });
        child.emit("error", error);
      });
      return child;
    });

    await expect(
      executeTerminalCommand({
        command: "date",
      }),
    ).rejects.toMatchObject({
      code: "command_not_found",
      statusCode: 404,
    });
  });
});
