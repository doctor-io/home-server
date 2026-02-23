import { describe, expect, it } from "vitest";
import {
  normalizeDockerProgressDetail,
  parseDockerPullEvent,
} from "@/lib/server/modules/store/docker-client";

describe("docker client parser", () => {
  it("normalizes progress detail into percent", () => {
    const result = normalizeDockerProgressDetail({
      current: 50,
      total: 200,
    });

    expect(result).toEqual({
      current: 50,
      total: 200,
      percent: 25,
    });
  });

  it("parses mixed docker pull events", () => {
    const pending = parseDockerPullEvent({
      status: "Downloading",
      id: "layer-1",
      progress: "[==> ]",
      progressDetail: {
        current: 128,
        total: 1024,
      },
    });

    const completed = parseDockerPullEvent({
      status: "Download complete",
      id: "layer-1",
    });

    expect(pending).toMatchObject({
      status: "Downloading",
      id: "layer-1",
      progressDetail: {
        current: 128,
        total: 1024,
        percent: 12.5,
      },
    });

    expect(completed).toMatchObject({
      status: "Download complete",
      id: "layer-1",
    });
  });
});
