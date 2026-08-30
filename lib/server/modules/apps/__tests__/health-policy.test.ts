import { describe, expect, it } from "vitest";
import { backoffFor, decideHealAction } from "@/lib/server/modules/apps/health-policy";
import type { ContainerEvent } from "@/lib/server/modules/apps/health-watchdog";
import type { AppHealth, RestartPolicy } from "@/lib/shared/contracts/app-health";

const NOW = new Date("2026-08-30T12:00:00Z");

function crash(overrides: Partial<ContainerEvent> = {}): ContainerEvent {
  return {
    action: "die",
    containerId: "abc",
    containerName: "jellyfin-web-1",
    project: "jellyfin",
    exitCode: 137,
    wasDeliberate: false,
    at: NOW,
    ...overrides,
  };
}

function health(policy: RestartPolicy, overrides: Partial<AppHealth> = {}): AppHealth {
  return {
    appId: "jellyfin",
    policy,
    maxRestarts: 3,
    windowMinutes: 10,
    state: "healthy",
    restartCount: 0,
    windowStartedAt: null,
    lastTransitionAt: null,
    mutedUntil: null,
    ...overrides,
  };
}

const FRESH = { count: 0, startedAt: null };

function decide(overrides: Partial<Parameters<typeof decideHealAction>[0]> = {}) {
  return decideHealAction({
    event: crash(),
    health: health("always"),
    window: FRESH,
    now: NOW,
    operationInFlight: false,
    enabled: true,
    ...overrides,
  });
}

describe("decideHealAction — guards, in order", () => {
  it("does nothing when auto-heal is off", () => {
    expect(decide({ enabled: false })).toMatchObject({ action: "none" });
  });

  it("stands down while an operation holds the app", () => {
    // Restarting a container mid-install is how a stack gets corrupted.
    expect(decide({ operationInFlight: true })).toMatchObject({
      action: "none",
      reason: expect.stringContaining("operation"),
    });
  });

  it("stands down while muted", () => {
    const mutedUntil = new Date(NOW.getTime() + 60_000).toISOString();

    expect(decide({ health: health("always", { mutedUntil }) })).toMatchObject({
      action: "none",
      reason: "muted",
    });
  });

  it("acts again once the mute has lapsed", () => {
    const mutedUntil = new Date(NOW.getTime() - 60_000).toISOString();

    expect(decide({ health: health("always", { mutedUntil }) })).toMatchObject({
      action: "restart",
    });
  });

  it("leaves a container the user stopped alone", () => {
    expect(decide({ event: crash({ wasDeliberate: true, exitCode: 143 }) })).toMatchObject({
      action: "none",
      reason: "not an unexpected exit",
    });
  });

  it("leaves a clean exit alone", () => {
    expect(decide({ event: crash({ exitCode: 0 }) })).toMatchObject({ action: "none" });
  });
});

describe("decideHealAction — policies", () => {
  it("does nothing under policy no", () => {
    expect(decide({ health: health("no") })).toMatchObject({
      action: "none",
      reason: 'policy is "no"',
    });
  });

  it("restarts under on-failure when the exit is non-zero", () => {
    expect(decide({ health: health("on-failure") })).toMatchObject({ action: "restart" });
  });

  it("restarts under always", () => {
    expect(decide({ health: health("always") })).toMatchObject({ action: "restart" });
  });

  it("restarts under unless-stopped, since deliberate stops never reach it", () => {
    expect(decide({ health: health("unless-stopped") })).toMatchObject({ action: "restart" });
  });
});

describe("decideHealAction — budget and backoff", () => {
  it("backs off further with each crash in the window", () => {
    const first = decide({ window: { count: 0, startedAt: null } });
    const second = decide({ window: { count: 1, startedAt: NOW } });

    expect(first).toMatchObject({ action: "restart", delayMs: 5_000 });
    expect(second).toMatchObject({ action: "restart", delayMs: 10_000 });
  });

  it("caps the backoff", () => {
    expect(backoffFor(50)).toBe(5 * 60_000);
  });

  it("stops the app once the budget is spent", () => {
    const result = decide({
      health: health("always", { maxRestarts: 3 }),
      window: { count: 3, startedAt: NOW },
    });

    expect(result).toMatchObject({
      action: "stop_and_notify",
      reason: "restarted 3 times in 10 minutes",
    });
  });

  it("starts a fresh budget after the window lapses", () => {
    const later = new Date(NOW.getTime() + 11 * 60_000);
    const result = decide({
      health: health("always", { maxRestarts: 3 }),
      window: { count: 3, startedAt: NOW },
      now: later,
      event: crash({ at: later }),
    });

    expect(result).toMatchObject({ action: "restart" });
  });
});
