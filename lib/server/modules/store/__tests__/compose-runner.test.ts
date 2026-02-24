import { describe, expect, it } from "vitest";
import {
  applyWebUiPortOverride,
  buildRawStackFileUrl,
  normalizeComposeStorageBindings,
  sanitizeStackName,
} from "@/lib/server/modules/store/compose-runner";

describe("compose runner helpers", () => {
  it("builds GitHub raw stack file URLs", () => {
    const url = buildRawStackFileUrl(
      "https://github.com/bigbeartechworld/big-bear-portainer",
      "Apps/Homepage/docker-compose.yml",
    );

    expect(url).toBe(
      "https://raw.githubusercontent.com/bigbeartechworld/big-bear-portainer/main/Apps/Homepage/docker-compose.yml",
    );
  });

  it("overrides first numeric host port mapping", () => {
    const compose = `
services:
  app:
    image: test:latest
    ports:
      - "3000:3000"
`;

    const updated = applyWebUiPortOverride(compose, 3100);
    expect(updated).toContain(`- "3100:3000"`);
  });

  it("sanitizes stack names", () => {
    expect(sanitizeStackName("AdGuard Home!")).toBe("adguard-home");
  });

  it("converts named volumes to bind mounts under DATA/Apps", () => {
    const compose = `
services:
  twofauth:
    image: 2fauth/2fauth:latest
    volumes:
      - "big-bear-2fauth_data:/2fauth"
      - "./config:/config"
volumes:
  big-bear-2fauth_data:
`;

    const normalized = normalizeComposeStorageBindings(
      compose,
      "/Users/ahmedtabib/Code/home-server/DATA/Apps",
    );

    expect(normalized.composeContent).toContain(
      '- "/Users/ahmedtabib/Code/home-server/DATA/Apps/big-bear-2fauth_data:/2fauth"',
    );
    expect(normalized.composeContent).toContain('- "./config:/config"');
    expect(normalized.composeContent).not.toContain("\nvolumes:\n  big-bear-2fauth_data:");
    expect(Array.from(normalized.bindMountDirectories)).toContain(
      "/Users/ahmedtabib/Code/home-server/DATA/Apps/big-bear-2fauth_data",
    );
  });
});
