import {
  applyWebUiPortOverride,
  buildRawStackFileUrl,
  normalizeComposeStorageBindings,
  sanitizeStackName,
} from "@/lib/server/modules/docker/compose-runner";
import { describe, expect, it } from "vitest";

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

  it("converts named volumes to bind mounts under DATA/AppData in legacy mode", () => {
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

    const stacksRoot = "/Users/ahmedtabib/Code/home-server/stacks";
    const appDataRoot = "/Users/ahmedtabib/Code/home-server/DATA/Apps";
    const normalized = normalizeComposeStorageBindings(
      compose,
      stacksRoot,
      appDataRoot,
      {
        appId: "twofauth",
        strategy: "legacy_named_source",
      },
    );

    expect(normalized.composeContent).toContain(
      '- "/Users/ahmedtabib/Code/home-server/DATA/Apps/big-bear-2fauth_data:/2fauth"',
    );
    expect(normalized.composeContent).toContain('- "./config:/config"');
    expect(normalized.composeContent).not.toContain(
      "\nvolumes:\n  big-bear-2fauth_data:",
    );
    expect(Array.from(normalized.bindMountDirectories)).toContain(
      "/Users/ahmedtabib/Code/home-server/DATA/Apps/big-bear-2fauth_data",
    );
  });

  it("converts named volumes to app-scoped target paths in app_target_path mode", () => {
    const compose = `
services:
  app:
    image: home-assistant:latest
    volumes:
      - "big-bear-home-assistant_config:/config"
      - "big-bear-home-assistant_media:/var/lib/homeassistant/media"
volumes:
  big-bear-home-assistant_config:
  big-bear-home-assistant_media:
`;

    const stacksRoot = "/DATA/Apps";
    const appDataRoot = "/DATA/Apps";
    const normalized = normalizeComposeStorageBindings(
      compose,
      stacksRoot,
      appDataRoot,
      {
        appId: "home-assistant",
        strategy: "app_target_path",
      },
    );

    expect(normalized.composeContent).toContain(
      '- "/DATA/Apps/home-assistant/config:/config"',
    );
    expect(normalized.composeContent).toContain(
      '- "/DATA/Apps/home-assistant/var/lib/homeassistant/media:/var/lib/homeassistant/media"',
    );
    expect(normalized.composeContent).not.toContain("big-bear-home-assistant_config:");
    expect(normalized.composeContent).not.toContain("big-bear-home-assistant_media:");
    expect(Array.from(normalized.bindMountDirectories)).toContain(
      "/DATA/Apps/home-assistant/config",
    );
    expect(Array.from(normalized.bindMountDirectories)).toContain(
      "/DATA/Apps/home-assistant/var/lib/homeassistant/media",
    );
  });
});
