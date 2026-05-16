import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

import { updateSystemPreferences } from "@/lib/server/modules/system/preferences-service";

function resolveExecFileCallback(args: unknown[]) {
  const maybeCallback = args.at(-1);
  if (typeof maybeCallback !== "function") {
    throw new Error("Expected execFile callback");
  }

  return maybeCallback as (error: Error | null, stdout?: string, stderr?: string) => void;
}

describe("preferences-service", () => {
  beforeEach(async () => {
    execFileMock.mockReset();
    const root = await mkdtemp(path.join(os.tmpdir(), "homeio-preferences-"));
    const timezonePath = path.join(root, "timezone");
    const hostsPath = path.join(root, "hosts");

    await mkdir(path.dirname(hostsPath), { recursive: true });
    await writeFile(timezonePath, "Etc/UTC\n", "utf8");
    await writeFile(hostsPath, "127.0.0.1 localhost\n127.0.1.1 homeio homeio.local\n", "utf8");

    process.env.HOMEIO_TIMEZONE_FILE_PATH = timezonePath;
    process.env.HOMEIO_HOSTS_FILE_PATH = hostsPath;
  });

  it("restarts avahi after hostname changes and rewrites the hosts file", async () => {
    let currentHostname = "homeio";
    const calls: Array<{ command: string; args: string[] }> = [];

    execFileMock.mockImplementation((command: string, args: string[], ...rest: unknown[]) => {
      calls.push({ command, args });
      const callback = resolveExecFileCallback(rest);

      if (command === "hostnamectl" && args[0] === "--static") {
        callback(null, `${currentHostname}\n`, "");
        return;
      }

      if (command === "hostname") {
        callback(null, `${currentHostname}\n`, "");
        return;
      }

      if (command === "timedatectl" && args[0] === "show") {
        callback(null, "Etc/UTC\n", "");
        return;
      }

      if (command === "hostnamectl" && args[0] === "set-hostname") {
        currentHostname = args[1] ?? currentHostname;
        callback(null, "", "");
        return;
      }

      if (command === "systemctl" && args[0] === "restart") {
        callback(null, "", "");
        return;
      }

      callback(null, "", "");
    });

    const preferences = await updateSystemPreferences({
      hostname: "homeai",
      timezone: "Etc/UTC",
    });

    expect(preferences.hostname).toBe("homeai");
    expect(calls).toEqual(
      expect.arrayContaining([
        { command: "hostnamectl", args: ["set-hostname", "homeai"] },
        { command: "systemctl", args: ["restart", "avahi-daemon"] },
      ]),
    );

    const hostsContent = await readFile(process.env.HOMEIO_HOSTS_FILE_PATH!, "utf8");
    expect(hostsContent).toContain("127.0.1.1 homeai homeai.local");
  });

  it("falls back to the hostname command when hostnamectl is unavailable", async () => {
    let currentHostname = "homeio";
    const calls: Array<{ command: string; args: string[] }> = [];

    execFileMock.mockImplementation((command: string, args: string[], ...rest: unknown[]) => {
      calls.push({ command, args });
      const callback = resolveExecFileCallback(rest);

      if (command === "hostnamectl" && args[0] === "--static") {
        const error = Object.assign(new Error("spawn hostnamectl ENOENT"), { code: "ENOENT" });
        callback(error as Error, "", "");
        return;
      }

      if (command === "hostname" && args.length === 0) {
        callback(null, `${currentHostname}\n`, "");
        return;
      }

      if (command === "hostname" && args.length === 1) {
        currentHostname = args[0] ?? currentHostname;
        callback(null, "", "");
        return;
      }

      if (command === "timedatectl" && args[0] === "show") {
        callback(null, "Etc/UTC\n", "");
        return;
      }

      if (command === "hostnamectl" && args[0] === "set-hostname") {
        const error = Object.assign(new Error("spawn hostnamectl ENOENT"), { code: "ENOENT" });
        callback(error as Error, "", "");
        return;
      }

      if (command === "systemctl" && args[0] === "restart") {
        callback(null, "", "");
        return;
      }

      callback(null, "", "");
    });

    const preferences = await updateSystemPreferences({
      hostname: "homeai",
      timezone: "Etc/UTC",
    });

    expect(preferences.hostname).toBe("homeai");
    expect(calls).toEqual(
      expect.arrayContaining([{ command: "hostname", args: ["homeai"] }]),
    );
  });

  it("falls back to writing the timezone file when timedatectl is unavailable", async () => {
    execFileMock.mockImplementation((command: string, args: string[], ...rest: unknown[]) => {
      const callback = resolveExecFileCallback(rest);

      if (command === "hostnamectl" && args[0] === "--static") {
        callback(null, "homeio\n", "");
        return;
      }

      if (command === "timedatectl" && args[0] === "show") {
        callback(null, "Etc/UTC\n", "");
        return;
      }

      if (command === "timedatectl" && args[0] === "set-timezone") {
        const error = Object.assign(new Error("spawn timedatectl ENOENT"), { code: "ENOENT" });
        callback(error as Error, "", "");
        return;
      }

      callback(null, "", "");
    });

    await updateSystemPreferences({
      hostname: "homeio",
      timezone: "Europe/Paris",
    });

    const timezoneContent = await readFile(process.env.HOMEIO_TIMEZONE_FILE_PATH!, "utf8");
    expect(timezoneContent.trim()).toBe("Europe/Paris");
  });

  it("does not fail the hostname update when avahi-daemon is unavailable", async () => {
    let currentHostname = "homeio";

    execFileMock.mockImplementation((command: string, args: string[], ...rest: unknown[]) => {
      const callback = resolveExecFileCallback(rest);

      if (command === "hostnamectl" && args[0] === "--static") {
        callback(null, `${currentHostname}\n`, "");
        return;
      }

      if (command === "hostname") {
        callback(null, `${currentHostname}\n`, "");
        return;
      }

      if (command === "timedatectl" && args[0] === "show") {
        callback(null, "Etc/UTC\n", "");
        return;
      }

      if (command === "hostnamectl" && args[0] === "set-hostname") {
        currentHostname = args[1] ?? currentHostname;
        callback(null, "", "");
        return;
      }

      if (command === "systemctl" && args[0] === "restart") {
        const error = new Error("Unit avahi-daemon.service could not be found.") as Error & {
          stdout?: string;
          stderr?: string;
        };
        error.stderr = "Unit avahi-daemon.service could not be found.";
        callback(error, "", "Unit avahi-daemon.service could not be found.");
        return;
      }

      callback(null, "", "");
    });

    const preferences = await updateSystemPreferences({
      hostname: "homeai",
      timezone: "Etc/UTC",
    });

    expect(preferences.hostname).toBe("homeai");
    const hostsContent = await readFile(process.env.HOMEIO_HOSTS_FILE_PATH!, "utf8");
    expect(hostsContent).toContain("127.0.1.1 homeai homeai.local");
  });
});
