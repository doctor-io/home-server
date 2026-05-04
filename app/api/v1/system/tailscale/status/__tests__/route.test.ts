import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/integrations/tailscale-status", () => ({
  getLocalTailscaleStatus: vi.fn(),
}));

import { GET } from "@/app/api/v1/system/tailscale/status/route";
import { getLocalTailscaleStatus } from "@/lib/server/modules/integrations/tailscale-status";

const connectedStatus = {
  installed: true,
  tunAvailable: true,
  running: true,
  connected: true,
  backendState: "Running",
  hostname: "homeserver",
  dnsName: "homeserver.example.ts.net",
  tailscaleIps: ["100.64.0.1"],
  issue: null,
  error: null,
};

describe("GET /api/v1/system/tailscale/status", () => {
  it("returns tailscale status data", async () => {
    vi.mocked(getLocalTailscaleStatus).mockResolvedValueOnce(connectedStatus);

    const response = await GET(new Request("http://localhost/api/v1/system/tailscale/status"));
    const json = (await response.json()) as { data: typeof connectedStatus };

    expect(response.status).toBe(200);
    expect(json.data.connected).toBe(true);
    expect(json.data.hostname).toBe("homeserver");
  });

  it("returns not-installed status when CLI is absent", async () => {
    vi.mocked(getLocalTailscaleStatus).mockResolvedValueOnce({
      installed: false,
      tunAvailable: true,
      running: false,
      connected: false,
      backendState: null,
      hostname: null,
      dnsName: null,
      tailscaleIps: [],
      issue: null,
      error: "Tailscale CLI is not installed.",
    });

    const response = await GET(new Request("http://localhost/api/v1/system/tailscale/status"));
    const json = (await response.json()) as { data: { installed: boolean; error: string } };

    expect(response.status).toBe(200);
    expect(json.data.installed).toBe(false);
  });

  it("returns 500 when status read throws", async () => {
    vi.mocked(getLocalTailscaleStatus).mockRejectedValueOnce(new Error("unexpected"));

    const response = await GET(new Request("http://localhost/api/v1/system/tailscale/status"));
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(500);
    expect(json.code).toBe("internal_error");
  });
});
