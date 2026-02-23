import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/store/compose-runner", () => ({
  extractComposeImages: vi.fn(),
}));

import { extractComposeImages } from "@/lib/server/modules/store/compose-runner";
import {
  extractDigestFromRepoDigest,
  parseRemoteDigestFromManifestOutput,
  resolveImageDigestState,
  resolveLocalImageDigest,
  resolveRemoteImageDigest,
  resolveStoreAppUpdateState,
} from "@/lib/server/modules/store/update-check";

describe("store update digest check", () => {
  beforeEach(() => {
    vi.mocked(extractComposeImages).mockReset();
  });

  it("extracts digest from repo digest references", () => {
    expect(extractDigestFromRepoDigest("nginx@sha256:abc123")).toBe("sha256:abc123");
    expect(extractDigestFromRepoDigest("nginx:latest")).toBeNull();
  });

  it("parses remote digest from verbose manifest output", () => {
    const digest = parseRemoteDigestFromManifestOutput(
      JSON.stringify({
        Ref: "docker.io/library/nginx:latest",
        Descriptor: {
          digest: "sha256:remote123",
        },
      }),
    );

    expect(digest).toBe("sha256:remote123");
  });

  it("parses remote digest from manifest list output", () => {
    const digest = parseRemoteDigestFromManifestOutput(
      JSON.stringify({
        schemaVersion: 2,
        manifests: [
          {
            digest: "sha256:list999",
          },
        ],
      }),
    );

    expect(digest).toBe("sha256:list999");
  });

  it("resolves local digest from docker image inspect output", async () => {
    const dockerExecutor = vi.fn(async () => ({
      stdout: JSON.stringify(["docker.io/library/nginx@sha256:local123"]),
      stderr: "",
    }));

    const digest = await resolveLocalImageDigest("nginx:test-local", dockerExecutor);

    expect(digest).toBe("sha256:local123");
    expect(dockerExecutor).toHaveBeenCalledWith([
      "image",
      "inspect",
      "nginx:test-local",
      "--format",
      "{{json .RepoDigests}}",
    ]);
  });

  it("resolves remote digest from pinned digest image refs without docker call", async () => {
    const dockerExecutor = vi.fn();

    const digest = await resolveRemoteImageDigest("nginx@sha256:pinned123", dockerExecutor);

    expect(digest).toBe("sha256:pinned123");
    expect(dockerExecutor).not.toHaveBeenCalled();
  });

  it("marks update as available when local and remote digests differ", async () => {
    const dockerExecutor = vi.fn(async (args: string[]) => {
      if (args[0] === "image" && args[2] === "redis:test-update") {
        return {
          stdout: JSON.stringify(["redis@sha256:local111"]),
          stderr: "",
        };
      }

      if (args[0] === "manifest" && args[3] === "redis:test-update") {
        return {
          stdout: JSON.stringify({
            Descriptor: {
              digest: "sha256:remote222",
            },
          }),
          stderr: "",
        };
      }

      throw new Error(`Unexpected docker args: ${args.join(" ")}`);
    });

    const result = await resolveImageDigestState("redis:test-update", dockerExecutor);

    expect(result).toEqual({
      image: "redis:test-update",
      localDigest: "sha256:local111",
      remoteDigest: "sha256:remote222",
      updateAvailable: true,
    });
  });

  it("aggregates stack update status from compose images", async () => {
    vi.mocked(extractComposeImages).mockResolvedValueOnce(["app:test-stack"]);

    const dockerExecutor = vi.fn(async (args: string[]) => {
      if (args[0] === "image" && args[2] === "app:test-stack") {
        return {
          stdout: JSON.stringify(["app@sha256:local777"]),
          stderr: "",
        };
      }

      if (args[0] === "manifest" && args[3] === "app:test-stack") {
        return {
          stdout: JSON.stringify({
            Descriptor: {
              digest: "sha256:remote888",
            },
          }),
          stderr: "",
        };
      }

      throw new Error(`Unexpected docker args: ${args.join(" ")}`);
    });

    const result = await resolveStoreAppUpdateState(
      {
        composePath: "/tmp/stacks/app/docker-compose.yml",
        stackName: "app-stack",
      },
      {
        dockerExecutor,
      },
    );

    expect(result).toEqual({
      updateAvailable: true,
      localDigest: "sha256:local777",
      remoteDigest: "sha256:remote888",
      image: "app:test-stack",
    });
  });
});

