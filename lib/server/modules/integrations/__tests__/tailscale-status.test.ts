import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockExecFile, mockAccess, mockWriteFile, mockUnlink } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
  mockAccess: vi.fn(),
  mockWriteFile: vi.fn(),
  mockUnlink: vi.fn(),
}));

vi.mock("node:child_process", () => ({ execFile: mockExecFile }));
vi.mock("node:fs/promises", () => ({
  access: mockAccess,
  writeFile: mockWriteFile,
  unlink: mockUnlink,
}));
vi.mock("node:util", () => ({
  promisify: (fn: unknown) => (fn === mockExecFile ? mockExecFile : fn),
}));

import { getLocalTailscaleStatus, installTailscale } from "@/lib/server/modules/integrations/tailscale-status";

const runningJson = JSON.stringify({
  BackendState: "Running",
  Self: {
    HostName: "homeserver",
    DNSName: "homeserver.example.ts.net",
    TailscaleIPs: ["100.64.0.1"],
    Online: true,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  mockUnlink.mockResolvedValue(undefined);
  mockWriteFile.mockResolvedValue(undefined);
});

describe("getLocalTailscaleStatus", () => {
  it("returns not-installed when CLI is absent", async () => {
    mockAccess.mockResolvedValue(undefined);
    const err = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    mockExecFile.mockRejectedValueOnce(err);

    const status = await getLocalTailscaleStatus();

    expect(status.installed).toBe(false);
    expect(status.connected).toBe(false);
    expect(status.error).toContain("not installed");
  });

  it("returns connected status when daemon is Running", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockExecFile.mockResolvedValueOnce({ stdout: runningJson, stderr: "" });

    const status = await getLocalTailscaleStatus();

    expect(status.installed).toBe(true);
    expect(status.connected).toBe(true);
    expect(status.hostname).toBe("homeserver");
    expect(status.tailscaleIps).toEqual(["100.64.0.1"]);
    expect(status.issue).toBeNull();
  });

  it("reports missing_tun when /dev/net/tun is absent", async () => {
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    mockExecFile.mockRejectedValueOnce(new Error("failed to open /dev/net/tun: no such file"));

    const status = await getLocalTailscaleStatus();

    expect(status.tunAvailable).toBe(false);
    expect(status.issue).toBe("missing_tun");
  });

  it("reports service_unavailable when daemon is down but TUN exists", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockExecFile.mockRejectedValueOnce(new Error("dial tcp: connect refused"));

    const status = await getLocalTailscaleStatus();

    expect(status.installed).toBe(true);
    expect(status.issue).toBe("service_unavailable");
  });
});

describe("installTailscale", () => {
  it("returns installed status without activating when no auth key", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockExecFile.mockResolvedValueOnce({ stdout: runningJson, stderr: "" });
    mockExecFile.mockResolvedValueOnce({ stdout: runningJson, stderr: "" });

    const result = await installTailscale(undefined);

    expect(result.installed).toBe(true);
    expect(result.activated).toBe(true);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("writes key to temp file and uses file: prefix instead of inline arg", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockExecFile
      .mockResolvedValueOnce({ stdout: runningJson, stderr: "" })
      .mockResolvedValueOnce({ stdout: runningJson, stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" });

    await installTailscale("tskey-auth-test");

    const tailscaleUpCall = mockExecFile.mock.calls.find(
      (call: unknown[]) =>
        Array.isArray(call[1]) &&
        (call[1] as string[]).some((a) => (a as string).startsWith("--auth-key")),
    );
    expect(tailscaleUpCall).toBeDefined();
    const authKeyArg = (tailscaleUpCall?.[1] as string[]).find((a) =>
      (a as string).startsWith("--auth-key"),
    );
    expect(authKeyArg).toMatch(/^--auth-key=file:/);
    expect(authKeyArg).not.toContain("tskey-auth-test");

    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining("ts-key-"),
      "tskey-auth-test",
      { mode: 0o600 },
    );
    expect(mockUnlink).toHaveBeenCalled();
  });

  it("cleans up temp file even when tailscale up fails", async () => {
    mockAccess.mockResolvedValue(undefined);
    const ok = { stdout: runningJson, stderr: "" };
    mockExecFile
      .mockResolvedValueOnce(ok)
      .mockResolvedValueOnce(ok)
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockRejectedValueOnce(new Error("auth failed"));

    await expect(installTailscale("tskey-bad")).rejects.toThrow("auth failed");

    expect(mockUnlink).toHaveBeenCalled();
  });

  it("rejects concurrent install calls", async () => {
    mockAccess.mockResolvedValue(undefined);
    let resolveFirst!: () => void;
    const slowPromise = new Promise<{ stdout: string; stderr: string }>((res) => {
      resolveFirst = () => res({ stdout: runningJson, stderr: "" });
    });
    mockExecFile.mockReturnValueOnce(slowPromise).mockReturnValue(slowPromise);

    const first = installTailscale(undefined);
    await expect(installTailscale(undefined)).rejects.toThrow("already in progress");
    resolveFirst();
    await first.catch(() => {});
  });
});
