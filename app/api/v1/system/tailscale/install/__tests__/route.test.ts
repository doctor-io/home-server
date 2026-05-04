import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/integrations/tailscale-status", () => ({
  installTailscale: vi.fn(),
}));

vi.mock("@/lib/server/modules/integrations/tailscale-config", () => ({
  getTailscaleConfig: vi.fn(),
}));

import { POST } from "@/app/api/v1/system/tailscale/install/route";
import { installTailscale } from "@/lib/server/modules/integrations/tailscale-status";
import { getTailscaleConfig } from "@/lib/server/modules/integrations/tailscale-config";

const makeRequest = (body: unknown) =>
  new Request("http://localhost/api/v1/system/tailscale/install", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/v1/system/tailscale/install", () => {
  it("uses auth key from request body when provided", async () => {
    vi.mocked(installTailscale).mockResolvedValueOnce({ installed: true, activated: true, stdout: "", stderr: "" });

    const response = await POST(makeRequest({ authKey: "tskey-auth-body" }));
    const json = (await response.json()) as { data: { activated: boolean } };

    expect(response.status).toBe(200);
    expect(json.data.activated).toBe(true);
    expect(vi.mocked(installTailscale)).toHaveBeenCalledWith("tskey-auth-body");
    expect(vi.mocked(getTailscaleConfig)).not.toHaveBeenCalled();
  });

  it("falls back to stored key when body auth key is empty", async () => {
    vi.mocked(getTailscaleConfig).mockResolvedValueOnce({ tailnet: "example.com", apiKey: "tskey-auth-stored" });
    vi.mocked(installTailscale).mockResolvedValueOnce({ installed: true, activated: true, stdout: "", stderr: "" });

    const response = await POST(makeRequest({ authKey: "" }));

    expect(response.status).toBe(200);
    expect(vi.mocked(installTailscale)).toHaveBeenCalledWith("tskey-auth-stored");
  });

  it("passes undefined when body key and stored key are both absent", async () => {
    vi.mocked(getTailscaleConfig).mockResolvedValueOnce(null);
    vi.mocked(installTailscale).mockResolvedValueOnce({ installed: true, activated: false, stdout: "", stderr: "Provide an auth key." });

    const response = await POST(makeRequest({}));
    const json = (await response.json()) as { data: { activated: boolean } };

    expect(response.status).toBe(200);
    expect(json.data.activated).toBe(false);
    expect(vi.mocked(installTailscale)).toHaveBeenCalledWith(undefined);
  });

  it("returns 500 when install throws", async () => {
    vi.mocked(getTailscaleConfig).mockResolvedValueOnce(null);
    vi.mocked(installTailscale).mockRejectedValueOnce(new Error("Tailscale requires /dev/net/tun."));

    const response = await POST(makeRequest({}));
    const json = (await response.json()) as { code: string; error: string };

    expect(response.status).toBe(500);
    expect(json.code).toBe("install_failed");
    expect(json.error).toContain("/dev/net/tun");
  });

  it("returns 500 when install is already in progress", async () => {
    vi.mocked(getTailscaleConfig).mockResolvedValueOnce(null);
    vi.mocked(installTailscale).mockRejectedValueOnce(new Error("Tailscale installation already in progress. Please wait."));

    const response = await POST(makeRequest({}));
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(500);
    expect(json.code).toBe("install_failed");
  });
});
