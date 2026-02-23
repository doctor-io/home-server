import "server-only";

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { LruCache } from "@/lib/server/cache/lru";
import { logServerAction, withServerTiming } from "@/lib/server/logging/logger";
import { extractComposeImages } from "@/lib/server/modules/store/compose-runner";

const execFileAsync = promisify(execFile);

type DockerExecutorOutput = {
  stdout: string;
  stderr: string;
};

type DockerExecutor = (args: string[]) => Promise<DockerExecutorOutput>;

const localDigestCache = new LruCache<{ digest: string | null }>(1000, 30_000);
const remoteDigestCache = new LruCache<{ digest: string | null }>(1000, 5 * 60_000);

export type ImageDigestState = {
  image: string;
  localDigest: string | null;
  remoteDigest: string | null;
  updateAvailable: boolean;
};

export type StoreAppUpdateState = {
  updateAvailable: boolean;
  localDigest: string | null;
  remoteDigest: string | null;
  image: string | null;
};

const defaultDockerExecutor: DockerExecutor = async (args) =>
  execFileAsync("docker", args, {
    maxBuffer: 1024 * 1024,
  });

function toStringOrNull(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function digestFromImageReference(image: string) {
  const digestIndex = image.lastIndexOf("@");
  if (digestIndex === -1) {
    return null;
  }

  return toStringOrNull(image.slice(digestIndex + 1));
}

export function extractDigestFromRepoDigest(value: string): string | null {
  const digestIndex = value.lastIndexOf("@");
  if (digestIndex === -1) {
    return null;
  }

  return toStringOrNull(value.slice(digestIndex + 1));
}

export function parseRemoteDigestFromManifestOutput(stdout: string): string | null {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      const digest = parseRemoteDigestFromManifestOutput(JSON.stringify(entry));
      if (digest) return digest;
    }
    return null;
  }

  const record = toRecord(parsed);
  if (!record) {
    return null;
  }

  const descriptor = toRecord(record.Descriptor);
  const descriptorDigest = toStringOrNull(descriptor?.digest);
  if (descriptorDigest) {
    return descriptorDigest;
  }

  const digest = toStringOrNull(record.digest);
  if (digest) {
    return digest;
  }

  const manifests = record.manifests;
  if (Array.isArray(manifests)) {
    for (const manifest of manifests) {
      const manifestRecord = toRecord(manifest);
      const manifestDigest = toStringOrNull(manifestRecord?.digest);
      if (manifestDigest) {
        return manifestDigest;
      }
    }
  }

  return null;
}

export async function resolveLocalImageDigest(
  image: string,
  dockerExecutor: DockerExecutor = defaultDockerExecutor,
) {
  const cached = localDigestCache.get(image);
  if (cached) {
    return cached.digest;
  }

  try {
    const { stdout } = await dockerExecutor([
      "image",
      "inspect",
      image,
      "--format",
      "{{json .RepoDigests}}",
    ]);

    const parsed = JSON.parse(stdout.trim()) as unknown;
    const repoDigests = Array.isArray(parsed) ? parsed : [];

    let digest: string | null = null;
    for (const repoDigest of repoDigests) {
      if (typeof repoDigest !== "string") continue;
      const extracted = extractDigestFromRepoDigest(repoDigest);
      if (extracted) {
        digest = extracted;
        break;
      }
    }

    localDigestCache.set(image, { digest });
    return digest;
  } catch (error) {
    logServerAction({
      level: "warn",
      layer: "system",
      action: "store.digest.local.resolve",
      status: "error",
      message: "Unable to resolve local image digest",
      meta: {
        image,
      },
      error,
    });

    localDigestCache.set(image, { digest: null });
    return null;
  }
}

export async function resolveRemoteImageDigest(
  image: string,
  dockerExecutor: DockerExecutor = defaultDockerExecutor,
) {
  const pinnedDigest = digestFromImageReference(image);
  if (pinnedDigest) {
    return pinnedDigest;
  }

  const cached = remoteDigestCache.get(image);
  if (cached) {
    return cached.digest;
  }

  try {
    const { stdout } = await dockerExecutor(["manifest", "inspect", "--verbose", image]);
    let digest = parseRemoteDigestFromManifestOutput(stdout);

    if (!digest) {
      const fallback = await dockerExecutor(["manifest", "inspect", image]);
      digest = parseRemoteDigestFromManifestOutput(fallback.stdout);
    }

    remoteDigestCache.set(image, { digest });
    return digest;
  } catch (error) {
    logServerAction({
      level: "warn",
      layer: "system",
      action: "store.digest.remote.resolve",
      status: "error",
      message: "Unable to resolve remote image digest",
      meta: {
        image,
      },
      error,
    });

    remoteDigestCache.set(image, { digest: null });
    return null;
  }
}

export async function resolveImageDigestState(
  image: string,
  dockerExecutor: DockerExecutor = defaultDockerExecutor,
): Promise<ImageDigestState> {
  const [localDigest, remoteDigest] = await Promise.all([
    resolveLocalImageDigest(image, dockerExecutor),
    resolveRemoteImageDigest(image, dockerExecutor),
  ]);

  return {
    image,
    localDigest,
    remoteDigest,
    updateAvailable: Boolean(localDigest && remoteDigest && localDigest !== remoteDigest),
  };
}

export async function resolveStoreAppUpdateState(
  input: {
    composePath: string;
    stackName: string;
  },
  options?: {
    dockerExecutor?: DockerExecutor;
  },
): Promise<StoreAppUpdateState> {
  return withServerTiming(
    {
      layer: "service",
      action: "store.apps.update.check",
      meta: {
        composePath: input.composePath,
        stackName: input.stackName,
      },
    },
    async () => {
      const envPath = path.join(path.dirname(input.composePath), ".env");
      const images = await extractComposeImages({
        composePath: input.composePath,
        envPath,
        stackName: input.stackName,
      });

      let fallbackImage: string | null = null;
      let fallbackLocalDigest: string | null = null;
      let fallbackRemoteDigest: string | null = null;

      for (const image of images) {
        const digestState = await resolveImageDigestState(image, options?.dockerExecutor);
        if (
          fallbackImage === null &&
          (digestState.localDigest !== null || digestState.remoteDigest !== null)
        ) {
          fallbackImage = digestState.image;
          fallbackLocalDigest = digestState.localDigest;
          fallbackRemoteDigest = digestState.remoteDigest;
        }

        if (digestState.updateAvailable) {
          return {
            updateAvailable: true,
            localDigest: digestState.localDigest,
            remoteDigest: digestState.remoteDigest,
            image: digestState.image,
          };
        }
      }

      return {
        updateAvailable: false,
        localDigest: fallbackLocalDigest,
        remoteDigest: fallbackRemoteDigest,
        image: fallbackImage,
      };
    },
  );
}

