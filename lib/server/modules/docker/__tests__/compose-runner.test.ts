import {
  applyWebUiPortOverride,
  cleanupComposeDataOnUninstall,
  collectComposeBindMountOwnershipOverrides,
  normalizeComposeStorageBindings,
  sanitizeStackName,
} from "@/lib/server/modules/docker/compose-runner";
import { parseComposeFile } from "@/lib/server/modules/docker/compose-parser";
import {
  resolveStoreAppDataRoot,
  resolveStoreStacksRoot,
} from "@/lib/server/storage/data-root";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("compose runner helpers", () => {
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

  it("keeps compose unchanged when no published port mapping exists", () => {
    const compose = `
services:
  app:
    image: test:latest
    network_mode: host
`;

    const updated = applyWebUiPortOverride(compose, 3100);
    expect(updated).toBe(compose);
  });

  it("sanitizes stack names", () => {
    expect(sanitizeStackName("AdGuard Home!")).toBe("adguard-home");
  });

  it("converts named volumes to bind mounts under DATA/Apps in legacy mode", () => {
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
    expect(normalized.composeContent).not.toContain(
      "big-bear-home-assistant_config:",
    );
    expect(normalized.composeContent).not.toContain(
      "big-bear-home-assistant_media:",
    );
    expect(Array.from(normalized.bindMountDirectories)).toContain(
      "/DATA/Apps/home-assistant/config",
    );
    expect(Array.from(normalized.bindMountDirectories)).toContain(
      "/DATA/Apps/home-assistant/var/lib/homeassistant/media",
    );
  });

  it("converts long-form named volumes to app-scoped bind mounts in app_target_path mode", () => {
    const compose = `
services:
  cloudflared:
    image: wisdomsky/cloudflared-web:latest
    volumes:
      - type: volume
        source: cloudflared_config
        target: /config
volumes:
  cloudflared_config:
`;

    const normalized = normalizeComposeStorageBindings(
      compose,
      "/DATA/AppData",
      "/DATA/AppData",
      {
        appId: "cloudflared",
        strategy: "app_target_path",
      },
    );

    expect(normalized.composeContent).toContain("- type: bind");
    expect(normalized.composeContent).toContain("source: /DATA/AppData/cloudflared/config");
    expect(parseComposeFile(normalized.composeContent)).not.toBeNull();
    expect(normalized.composeContent).not.toContain("cloudflared_config:");
    expect(Array.from(normalized.bindMountDirectories)).toContain(
      "/DATA/AppData/cloudflared/config",
    );
  });

  it("rewrites CasaOS app-data bind mounts into app-scoped paths on fresh installs", () => {
    const compose = `
services:
  cloudflared:
    image: wisdomsky/cloudflared-web:latest
    volumes:
      - type: bind
        source: /DATA/AppData/casaos-cloudflared/config
        target: /config
      - "/DATA/AppData/data:/data"
`;

    const normalized = normalizeComposeStorageBindings(
      compose,
      "/DATA/AppData",
      "/DATA/AppData",
      {
        appId: "cloudflared",
        strategy: "app_target_path",
      },
    );

    expect(normalized.composeContent).toContain("source: /DATA/AppData/cloudflared/config");
    expect(normalized.composeContent).toContain('- "/DATA/AppData/cloudflared/data:/data"');
    expect(Array.from(normalized.bindMountDirectories)).toContain(
      "/DATA/AppData/cloudflared/config",
    );
    expect(Array.from(normalized.bindMountDirectories)).toContain(
      "/DATA/AppData/cloudflared/data",
    );
  });

  it("collects app-data ownership overrides for Grafana bind mounts", () => {
    const compose = `
services:
  grafana:
    image: grafana/grafana:12.1.4
    volumes:
      - type: bind
        source: /DATA/AppData/grafana/data
        target: /var/lib/grafana
`;

    expect(collectComposeBindMountOwnershipOverrides(compose)).toEqual([
      {
        directoryPath: "/DATA/AppData/grafana/data",
        uid: 472,
        gid: 472,
      },
    ]);
  });

  it("does not collect ownership overrides for unrelated bind mounts", () => {
    const compose = `
services:
  app:
    image: nginx:latest
    volumes:
      - /DATA/AppData/nginx/data:/usr/share/nginx/html
`;

    expect(collectComposeBindMountOwnershipOverrides(compose)).toEqual([]);
  });

  it("removes the installed stack directory during uninstall cleanup without deleting app data by default", async () => {
    const stacksRoot = resolveStoreStacksRoot();
    const appDataRoot = resolveStoreAppDataRoot();
    const appId = `cleanup-test-${Date.now()}`;
    const stackDir = path.join(stacksRoot, appId);
    const composePath = path.join(stackDir, "docker-compose.yml");
    const bindDir = path.join(appDataRoot, appId, "data");

    await mkdir(bindDir, { recursive: true });
    await mkdir(stackDir, { recursive: true });
    await writeFile(
      composePath,
      `services:
  app:
    image: nginx:latest
    volumes:
      - "${bindDir}:/data"
`,
      "utf8",
    );

    await cleanupComposeDataOnUninstall({
      composePath,
      removeVolumes: false,
    });

    await expect(
      rm(stackDir, {
        recursive: true,
        force: false,
      }),
    ).rejects.toThrow();

    await expect(
      rm(bindDir, {
        recursive: true,
        force: false,
      }),
    ).resolves.toBeUndefined();
  });

  it("removes long-form app-data bind mount directories during uninstall cleanup when requested", async () => {
    const stacksRoot = resolveStoreStacksRoot();
    const appDataRoot = resolveStoreAppDataRoot();
    const appId = `cleanup-long-form-${Date.now()}`;
    const stackDir = path.join(stacksRoot, appId);
    const composePath = path.join(stackDir, "docker-compose.yml");
    const bindDir = path.join(appDataRoot, appId, "config");

    await mkdir(bindDir, { recursive: true });
    await mkdir(stackDir, { recursive: true });
    await writeFile(
      composePath,
      `services:
  app:
    image: nginx:latest
    volumes:
      - type: bind
        source: ${bindDir}
        target: /config
`,
      "utf8",
    );

    await cleanupComposeDataOnUninstall({
      composePath,
      removeVolumes: true,
    });

    await expect(
      rm(stackDir, {
        recursive: true,
        force: false,
      }),
    ).rejects.toThrow();

    await expect(
      rm(bindDir, {
        recursive: true,
        force: false,
      }),
    ).rejects.toThrow();
  });

  it("removes interpolated AppID app-data bind mount directories during uninstall cleanup when requested", async () => {
    const stacksRoot = resolveStoreStacksRoot();
    const appDataRoot = resolveStoreAppDataRoot();
    const appId = `cleanup-appid-${Date.now()}`;
    const stackDir = path.join(stacksRoot, appId);
    const composePath = path.join(stackDir, "docker-compose.yml");
    const bindDir = path.join(appDataRoot, appId, "data");

    await mkdir(bindDir, { recursive: true });
    await mkdir(stackDir, { recursive: true });
    await writeFile(path.join(stackDir, ".env"), "", "utf8");
    await writeFile(
      composePath,
      `services:
  app:
    image: grafana/grafana:12.1.4
    volumes:
      - type: bind
        source: ${appDataRoot}/$AppID/data
        target: /var/lib/grafana
`,
      "utf8",
    );

    await cleanupComposeDataOnUninstall({
      composePath,
      removeVolumes: true,
    });

    await expect(
      rm(bindDir, {
        recursive: true,
        force: false,
      }),
    ).rejects.toThrow();
  });
});
