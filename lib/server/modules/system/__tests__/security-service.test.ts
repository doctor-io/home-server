import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

import {
  buildFail2BanOverrideContent,
  getSystemSecuritySettings,
  updateSystemSecuritySettings,
} from "@/lib/server/modules/system/security-service";

function resolveExecFileCallback(args: unknown[]) {
  const maybeCallback = args.at(-1);
  if (typeof maybeCallback !== "function") {
    throw new Error("Expected execFile callback");
  }

  return maybeCallback as (error: Error | null, stdout?: string, stderr?: string) => void;
}

describe("security-service", () => {
  beforeEach(async () => {
    execFileMock.mockReset();
    const root = await mkdtemp(path.join(os.tmpdir(), "homeio-security-"));
    process.env.HOMEIO_FAIL2BAN_OVERRIDE_PATH = path.join(root, "jail.d", "homeio.local");
  });

  it("reads UFW and Fail2Ban state from the host", async () => {
    execFileMock.mockImplementation((command: string, args: string[], ...rest: unknown[]) => {
      const callback = resolveExecFileCallback(rest);

      if (command === "ufw") {
        callback(
          null,
          "Status: active\nDefault: deny (incoming), allow (outgoing), disabled (routed)\n",
          "",
        );
        return;
      }

      if (command === "systemctl") {
        callback(null, "enabled\n", "");
        return;
      }

      callback(null, "", "");
    });

    const settings = await getSystemSecuritySettings();

    expect(settings).toEqual({
      firewallEnabled: true,
      firewallIncomingPolicy: "deny",
      firewallOutgoingPolicy: "allow",
      fail2banEnabled: true,
      fail2banMaxRetries: 5,
      fail2banBanDurationSeconds: 3600,
    });
  });

  it("treats missing Fail2Ban service as unavailable but non-fatal state", async () => {
    execFileMock.mockImplementation((command: string, args: string[], ...rest: unknown[]) => {
      const callback = resolveExecFileCallback(rest);

      if (command === "ufw") {
        callback(
          null,
          "Status: active\nDefault: deny (incoming), allow (outgoing), disabled (routed)\n",
          "",
        );
        return;
      }

      if (command === "systemctl") {
        const error = new Error("Command failed: systemctl is-enabled fail2ban") as Error & {
          stdout?: string;
          stderr?: string;
        };
        error.stdout = "not-found\n";
        error.stderr = "Unit fail2ban.service could not be found.\n";
        callback(error, "not-found\n", "Unit fail2ban.service could not be found.\n");
        return;
      }

      callback(null, "", "");
    });

    const settings = await getSystemSecuritySettings();

    expect(settings.fail2banEnabled).toBe(false);
    expect(settings.fail2banMaxRetries).toBe(5);
    expect(settings.fail2banBanDurationSeconds).toBe(3600);
  });

  it("writes managed Fail2Ban override config correctly", async () => {
    const content = buildFail2BanOverrideContent({
      maxRetries: 7,
      banDurationSeconds: 7200,
    });

    expect(content).toContain("[DEFAULT]");
    expect(content).toContain("maxretry = 7");
    expect(content).toContain("bantime = 7200");
  });

  it("applies UFW and Fail2Ban commands in the correct order", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];

    execFileMock.mockImplementation((command: string, args: string[], ...rest: unknown[]) => {
      calls.push({ command, args });
      const callback = resolveExecFileCallback(rest);

      if (command === "ufw" && args[0] === "status") {
        callback(
          null,
          "Status: active\nDefault: deny (incoming), allow (outgoing), disabled (routed)\n",
          "",
        );
        return;
      }

      if (command === "systemctl" && args[0] === "is-enabled") {
        callback(null, "enabled\n", "");
        return;
      }

      callback(null, "", "");
    });

    await updateSystemSecuritySettings({
      firewallEnabled: true,
      firewallIncomingPolicy: "reject",
      firewallOutgoingPolicy: "deny",
      fail2banEnabled: true,
      fail2banMaxRetries: 7,
      fail2banBanDurationSeconds: 7200,
    });

    expect(calls).toEqual(
      expect.arrayContaining([
        { command: "ufw", args: ["default", "reject", "incoming"] },
        { command: "ufw", args: ["default", "deny", "outgoing"] },
        { command: "ufw", args: ["--force", "enable"] },
        { command: "systemctl", args: ["enable", "--now", "fail2ban"] },
        { command: "systemctl", args: ["restart", "fail2ban"] },
      ]),
    );

    const overrideContent = await readFile(
      process.env.HOMEIO_FAIL2BAN_OVERRIDE_PATH!,
      "utf8",
    );
    expect(overrideContent).toContain("maxretry = 7");
    expect(overrideContent).toContain("bantime = 7200");
  });

  it("disables Fail2Ban and UFW with the correct commands", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];

    execFileMock.mockImplementation((command: string, args: string[], ...rest: unknown[]) => {
      calls.push({ command, args });
      const callback = resolveExecFileCallback(rest);
      if (command === "ufw" && args[0] === "status") {
        callback(null, "Status: inactive\n", "");
        return;
      }
      if (command === "systemctl" && args[0] === "is-enabled") {
        const error = new Error("disabled") as Error & { stdout?: string };
        error.stdout = "disabled\n";
        callback(error, "disabled\n", "");
        return;
      }
      callback(null, "", "");
    });

    await updateSystemSecuritySettings({
      firewallEnabled: false,
      firewallIncomingPolicy: "deny",
      firewallOutgoingPolicy: "allow",
      fail2banEnabled: false,
      fail2banMaxRetries: 5,
      fail2banBanDurationSeconds: 3600,
    });

    expect(calls).toEqual(
      expect.arrayContaining([
        { command: "ufw", args: ["--force", "disable"] },
        { command: "systemctl", args: ["disable", "--now", "fail2ban"] },
      ]),
    );
  });
});
