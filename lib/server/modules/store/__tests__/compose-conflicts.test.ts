import { describe, expect, it } from "vitest";
import {
  detectComposeConflicts,
  publishedHostPorts,
} from "@/lib/server/modules/store/compose-conflicts";

const INSTALLED = [
  { appId: "jellyfin", stackName: "jellyfin", webUiPort: 8096 },
  { appId: "nextcloud", stackName: "nextcloud", webUiPort: 8080 },
  { appId: "headless", stackName: "headless", webUiPort: null },
];

function compose(body: string) {
  return `services:\n${body}`;
}

describe("publishedHostPorts", () => {
  it("reads the host side of short syntax", () => {
    expect(publishedHostPorts({ ports: ["8080:80"] })).toEqual([8080]);
  });

  it("reads the host side when an interface is bound", () => {
    expect(publishedHostPorts({ ports: ["127.0.0.1:8080:80"] })).toEqual([8080]);
  });

  it("ignores container-only ports, which Docker assigns freely", () => {
    expect(publishedHostPorts({ ports: ["80"] })).toEqual([]);
  });

  it("expands a host range", () => {
    expect(publishedHostPorts({ ports: ["8080-8082:80"] })).toEqual([8080, 8081, 8082]);
  });

  it("reads the long syntax", () => {
    expect(publishedHostPorts({ ports: [{ target: 80, published: 8080 }] })).toEqual([8080]);
  });

  it("bounds an absurd range instead of building a huge list", () => {
    expect(publishedHostPorts({ ports: ["1-65535:80"] }).length).toBeLessThanOrEqual(129);
  });

  it("returns nothing when a service publishes nothing", () => {
    expect(publishedHostPorts({ image: "nginx" })).toEqual([]);
  });
});

describe("detectComposeConflicts", () => {
  it("finds a port already published by another app", () => {
    const conflicts = detectComposeConflicts({
      composeContent: compose("  web:\n    image: nginx\n    ports:\n      - '8096:80'\n"),
      appId: "custom-thing",
      installedStacks: INSTALLED,
    });

    expect(conflicts).toEqual([
      expect.objectContaining({ code: "port_in_use", service: "web", value: "8096" }),
    ]);
    expect(conflicts[0].detail).toContain("jellyfin");
  });

  it("says nothing when the ports are free", () => {
    expect(
      detectComposeConflicts({
        composeContent: compose("  web:\n    image: nginx\n    ports:\n      - '9999:80'\n"),
        appId: "custom-thing",
        installedStacks: INSTALLED,
      }),
    ).toEqual([]);
  });

  it("does not report an app colliding with itself on reinstall", () => {
    expect(
      detectComposeConflicts({
        composeContent: compose("  web:\n    image: nginx\n    ports:\n      - '8096:80'\n"),
        appId: "jellyfin",
        installedStacks: INSTALLED,
      }),
    ).toEqual([]);
  });

  it("reports a port once even when several services publish it", () => {
    const conflicts = detectComposeConflicts({
      composeContent: compose(
        "  a:\n    image: nginx\n    ports:\n      - '8080:80'\n  b:\n    image: nginx\n    ports:\n      - '8080:81'\n",
      ),
      appId: "custom-thing",
      installedStacks: INSTALLED,
    });

    expect(conflicts).toHaveLength(1);
  });

  it("finds a taken container name, case-insensitively", () => {
    const conflicts = detectComposeConflicts({
      composeContent: compose("  web:\n    image: nginx\n    container_name: Jellyfin\n"),
      appId: "custom-thing",
      installedStacks: INSTALLED,
      usedContainerNames: ["jellyfin"],
    });

    expect(conflicts[0]).toMatchObject({ code: "container_name_taken", value: "Jellyfin" });
  });

  it("stays quiet on malformed compose, which validation already owns", () => {
    expect(
      detectComposeConflicts({
        composeContent: "::: not yaml :::",
        appId: "custom-thing",
        installedStacks: INSTALLED,
      }),
    ).toEqual([]);
  });
});
