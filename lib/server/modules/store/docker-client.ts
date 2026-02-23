import "server-only";

import { request } from "node:http";
import { serverEnv } from "@/lib/server/env";
import type { DockerPullProgressDetail } from "@/lib/shared/contracts/apps";

type DockerProgressDetailRaw = {
  current?: unknown;
  total?: unknown;
};

type DockerPullEventRaw = {
  status?: unknown;
  id?: unknown;
  progress?: unknown;
  progressDetail?: DockerProgressDetailRaw;
  error?: unknown;
};

export type DockerPullEvent = {
  status: string;
  id?: string;
  progress?: string;
  progressDetail?: DockerPullProgressDetail;
  error?: string;
};

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toStringOrUndefined(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export function normalizeDockerProgressDetail(
  value: DockerProgressDetailRaw | undefined,
): DockerPullProgressDetail | undefined {
  if (!value) return undefined;

  const current = toNumber(value.current);
  const total = toNumber(value.total);
  const percent = total > 0 ? Number(((current / total) * 100).toFixed(2)) : null;

  return {
    current,
    total,
    percent,
  };
}

export function parseDockerPullEvent(value: unknown): DockerPullEvent | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as DockerPullEventRaw;
  const status = toStringOrUndefined(raw.status) ?? "unknown";
  const parsed: DockerPullEvent = {
    status,
  };

  const id = toStringOrUndefined(raw.id);
  if (id) parsed.id = id;

  const progress = toStringOrUndefined(raw.progress);
  if (progress) parsed.progress = progress;

  const progressDetail = normalizeDockerProgressDetail(raw.progressDetail);
  if (progressDetail) parsed.progressDetail = progressDetail;

  const error = toStringOrUndefined(raw.error);
  if (error) parsed.error = error;

  return parsed;
}

export async function pullDockerImage(
  image: string,
  onEvent?: (event: DockerPullEvent) => Promise<void> | void,
) {
  const path = `/images/create?fromImage=${encodeURIComponent(image)}`;

  await new Promise<void>((resolve, reject) => {
    const req = request(
      {
        socketPath: serverEnv.DOCKER_SOCKET_PATH,
        path,
        method: "POST",
        headers: {
          Host: "docker",
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            body += chunk;
          });
          res.on("end", () => {
            reject(new Error(`Docker pull failed (${res.statusCode}): ${body}`));
          });
          return;
        }

        let buffered = "";

        const handleLine = async (line: string) => {
          const trimmed = line.trim();
          if (!trimmed) return;

          let raw: unknown;
          try {
            raw = JSON.parse(trimmed);
          } catch {
            return;
          }

          const event = parseDockerPullEvent(raw);
          if (!event) return;

          if (event.error) {
            throw new Error(event.error);
          }

          if (onEvent) {
            await onEvent(event);
          }
        };

        res.on("data", (chunk) => {
          buffered += chunk.toString("utf8");
          const lines = buffered.split("\n");
          buffered = lines.pop() ?? "";

          void (async () => {
            for (const line of lines) {
              await handleLine(line);
            }
          })().catch((error) => {
            req.destroy(error as Error);
          });
        });

        res.on("end", () => {
          void (async () => {
            if (buffered.trim().length > 0) {
              await handleLine(buffered);
            }
          })()
            .then(() => resolve())
            .catch(reject);
        });
      },
    );

    req.on("error", (error) => {
      reject(error);
    });

    req.end();
  });
}
