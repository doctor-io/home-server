import { describe, expect, it } from "vitest";

import {
  buildInstallPayloadFromClassic,
  classicStateToCompose,
  composeToClassicState,
  createDefaultClassicState,
  safeComposeToClassicState,
} from "@/components/desktop/apps/configurator-mapper";

describe("configurator-mapper", () => {
  it("maps compose draft to classic state", () => {
    const composeDraft = `services:\n  app:\n    image: ghcr.io/example/app:latest\n    ports:\n      - \"8080:80\"\n    volumes:\n      - \"/data/app:/config\"\n    environment:\n      APP_URL: \"http://example.local:8080\"\n      TZ: \"UTC\"\n    network_mode: bridge\n    restart: unless-stopped\n    privileged: true\n    cap_add:\n      - NET_ADMIN\n    hostname: example-app\n    devices:\n      - /dev/ttyUSB0:/dev/ttyUSB0\n    command: [\"--config\",\"/config/settings.yaml\"]\n`;

    const state = composeToClassicState({
      composeDraft,
      seed: {
        title: "Example",
        iconUrl: "",
        fallbackPort: 8080,
      },
    });

    expect(state.dockerImage).toBe("ghcr.io/example/app:latest");
    expect(state.webUi.port).toBe("8080");
    expect(state.ports[0]?.container).toBe("80");
    expect(state.volumes[0]?.host).toBe("/data/app");
    expect(state.envVars.find((entry) => entry.key === "TZ")?.value).toBe("UTC");
    expect(state.restartPolicy).toBe("unless-stopped");
    expect(state.privileged).toBe(true);
    expect(state.capabilities).toContain("NET_ADMIN");
    expect(state.devices[0]).toBe("/dev/ttyUSB0:/dev/ttyUSB0");
    expect(state.containerCommands).toEqual(["--config", "/config/settings.yaml"]);
  });

  it("maps classic state back to compose while keeping unknown top-level fields", () => {
    const seed = createDefaultClassicState({
      title: "Sample",
      iconUrl: "",
      fallbackPort: 8080,
    });

    const nextState = {
      ...seed,
      dockerImage: "nginx:1.27",
      hostname: "sample-app",
      envVars: [{ id: "env-1", key: "TZ", value: "UTC" }],
      ports: [{ id: "p-1", host: "18080", container: "80", protocol: "TCP" as const }],
    };

    const previousCompose = `name: sample-stack\nservices:\n  app:\n    image: old:image\n`;
    const compose = classicStateToCompose(nextState, previousCompose);

    expect(compose).toContain("name: sample-stack");
    expect(compose).toContain("image: nginx:1.27");
    expect(compose).toContain("18080:80");
    expect(compose).toContain("hostname: sample-app");
    expect(compose).toContain("TZ: UTC");
  });

  it("returns parse error for invalid yaml", () => {
    const parsed = safeComposeToClassicState({
      composeDraft: "services:\n  app: [",
      seed: {
        title: "Broken",
        iconUrl: "",
      },
    });

    expect(parsed.state).toBeNull();
    expect(parsed.error).toBeTruthy();
  });

  it("builds install payload including env and web ui port", () => {
    const state = createDefaultClassicState({
      title: "Install Me",
      iconUrl: "",
      fallbackPort: 8080,
      fallbackHost: "localhost",
    });

    const payload = buildInstallPayloadFromClassic({
      appId: "install-me",
      state: {
        ...state,
        envVars: [{ id: "env-1", key: "TZ", value: "UTC" }],
      },
    });

    expect(payload.appId).toBe("install-me");
    expect(payload.webUiPort).toBe(8080);
    expect(payload.env?.TZ).toBe("UTC");
    expect(payload.env?.APP_URL).toContain("localhost:8080");
  });

  it("patches only immich primary service and preserves other compose content", () => {
    const immichCompose = `services:
  immich-server:
    image: ghcr.io/immich-app/immich-server:v2.5.0
    ports:
      - "2283:2283"
    depends_on:
      - redis
      - database
    environment:
      TZ: UTC
  immich-machine-learning:
    image: ghcr.io/immich-app/immich-machine-learning:v2.5.0
  redis:
    image: redis:7
  database:
    image: postgres:14
    volumes:
      - pgdata:/var/lib/postgresql/data
networks:
  default:
    name: immich_default
volumes:
  pgdata:
`;

    const parsed = safeComposeToClassicState({
      composeDraft: immichCompose,
      seed: { title: "Immich", iconUrl: "" },
      appId: "immich",
      primaryServiceName: "immich-server",
    });
    expect(parsed.error).toBeNull();
    expect(parsed.state?.dockerImage).toBe("ghcr.io/immich-app/immich-server:v2.5.0");

    const nextCompose = classicStateToCompose(
      {
        ...parsed.state!,
        dockerImage: "ghcr.io/immich-app/immich-server:v2.5.6",
        envVars: [{ id: "env-1", key: "TZ", value: "Europe/Paris" }],
      },
      immichCompose,
      { appId: "immich", primaryServiceName: "immich-server" },
    );

    expect(nextCompose).toContain("immich-server:");
    expect(nextCompose).toContain("image: ghcr.io/immich-app/immich-server:v2.5.6");
    expect(nextCompose).toContain("immich-machine-learning:");
    expect(nextCompose).toContain("redis:");
    expect(nextCompose).toContain("depends_on:");
    expect(nextCompose).toContain("volumes:");
    expect(nextCompose).toContain("pgdata:");
    expect(nextCompose).toContain("networks:");
    expect(nextCompose).not.toContain("\n  app:\n");
  });
});
