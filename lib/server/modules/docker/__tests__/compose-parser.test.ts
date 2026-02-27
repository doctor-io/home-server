import { describe, expect, it } from "vitest";

import {
  extractPrimaryServiceWithName,
  parseComposeFile,
} from "@/lib/server/modules/docker/compose-parser";

describe("compose-parser primary service selection", () => {
  it("prefers app service over db sidecar for appId matches", () => {
    const compose = `services:
  app:
    image: photoprism/photoprism:240915
    ports:
      - "2342:2342"
  photoprism-db:
    image: mariadb:10.8
`;

    const parsed = parseComposeFile(compose);
    expect(parsed).not.toBeNull();

    const primary = extractPrimaryServiceWithName(parsed!, "photoprism");
    expect(primary?.name).toBe("app");
    expect(primary?.service.image).toBe("photoprism/photoprism:240915");
    expect(primary?.service.ports?.[0]).toBe("2342:2342");
  });
});
