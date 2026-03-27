import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/auth/service", () => ({
  authenticateSession: vi.fn(),
}));

vi.mock("@/lib/server/modules/docker/maintenance-service", () => ({
  pruneDockerVolumes: vi.fn(),
}));

import { POST } from "@/app/api/v1/docker/prune/volumes/route";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import { pruneDockerVolumes } from "@/lib/server/modules/docker/maintenance-service";

describe("/api/v1/docker/prune/volumes", () => {
  it("returns 401 for unauthenticated requests", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce(null);

    const response = await POST(
      new NextRequest("http://localhost/api/v1/docker/prune/volumes"),
    );

    expect(response.status).toBe(401);
  });

  it("prunes docker volumes for authenticated users", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce({
      sessionId: "s1",
      userId: "u1",
      username: "ahmed",
      passwordHash: "hash",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.mocked(pruneDockerVolumes).mockResolvedValueOnce({
      command: "volumes",
      output: "Deleted Volumes:\nold-volume",
    });

    const response = await POST(
      new NextRequest("http://localhost/api/v1/docker/prune/volumes", {
        method: "POST",
        headers: {
          cookie: "homeio_session=session-token",
        },
      }),
    );
    const json = (await response.json()) as {
      data: { command: string; output: string };
    };

    expect(response.status).toBe(200);
    expect(pruneDockerVolumes).toHaveBeenCalledTimes(1);
    expect(json.data.command).toBe("volumes");
  });

  it("returns 500 when prune fails", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce({
      sessionId: "s1",
      userId: "u1",
      username: "ahmed",
      passwordHash: "hash",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.mocked(pruneDockerVolumes).mockRejectedValueOnce(new Error("docker volume prune failed"));

    const response = await POST(
      new NextRequest("http://localhost/api/v1/docker/prune/volumes", {
        method: "POST",
        headers: {
          cookie: "homeio_session=session-token",
        },
      }),
    );
    const json = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to prune Docker volumes");
  });
});
