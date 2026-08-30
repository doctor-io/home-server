import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHealthRunner, type HealthRunnerDeps } from "@/lib/server/modules/apps/health-runner";
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

function makeRunner(overrides: Partial<HealthRunnerDeps> = {}) {
  const deps: HealthRunnerDeps = {
    resolveAppId: vi.fn(async () => "jellyfin"),
    loadHealth: vi.fn(async () => health("always")),
    recordState: vi.fn(async () => {}),
    restartApp: vi.fn(async () => {}),
    stopApp: vi.fn(async () => {}),
    notify: vi.fn(async () => {}),
    hasActiveOperation: vi.fn(() => false),
    enabled: () => true,
    now: () => NOW,
    // Run scheduled work immediately so a backoff does not slow the suite.
    schedule: (fn) => fn(),
    ...overrides,
  };

  return { runner: createHealthRunner(deps), deps };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("health runner", () => {
  it("restarts a crashed app under an always policy", async () => {
    const { runner, deps } = makeRunner();

    await runner.handleEvent(crash());

    expect(deps.restartApp).toHaveBeenCalledWith("jellyfin");
    expect(deps.recordState).toHaveBeenCalledWith(
      expect.objectContaining({ state: "restarting", restartCount: 1 }),
    );
  });

  it("ignores containers it cannot trace to an app", async () => {
    const { runner, deps } = makeRunner({ resolveAppId: vi.fn(async () => null) });

    await runner.handleEvent(crash({ project: "something-else" }));

    expect(deps.loadHealth).not.toHaveBeenCalled();
    expect(deps.restartApp).not.toHaveBeenCalled();
  });

  it("leaves a container the user stopped alone, but still records what it saw", async () => {
    const { runner, deps } = makeRunner();

    await runner.handleEvent(crash({ wasDeliberate: true, exitCode: 143 }));

    expect(deps.restartApp).not.toHaveBeenCalled();
    expect(deps.recordState).toHaveBeenCalled();
  });

  it("does not restart while an operation holds the app", async () => {
    const { runner, deps } = makeRunner({ hasActiveOperation: vi.fn(() => true) });

    await runner.handleEvent(crash());

    expect(deps.restartApp).not.toHaveBeenCalled();
  });

  it("re-checks the guard when the backoff fires, not only when it is scheduled", async () => {
    // An install can start during the wait; the decision predates it.
    let inFlight = false;
    const { runner, deps } = makeRunner({
      hasActiveOperation: vi.fn(() => inFlight),
      schedule: (fn) => {
        inFlight = true;
        fn();
      },
    });

    await runner.handleEvent(crash());

    expect(deps.restartApp).not.toHaveBeenCalled();
  });

  it("stops and reports once the budget is spent", async () => {
    const { runner, deps } = makeRunner({
      loadHealth: vi.fn(async () => health("always", { maxRestarts: 2 })),
    });

    await runner.handleEvent(crash());
    await runner.handleEvent(crash());
    await runner.handleEvent(crash());

    expect(deps.stopApp).toHaveBeenCalledWith("jellyfin");
    expect(deps.notify).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "error", title: expect.stringContaining("jellyfin") }),
    );
    expect(deps.recordState).toHaveBeenCalledWith(
      expect.objectContaining({ state: "stopped_by_policy" }),
    );
  });

  it("says what it did and why in the notification", async () => {
    const { runner, deps } = makeRunner({
      loadHealth: vi.fn(async () => health("always", { maxRestarts: 1 })),
    });

    await runner.handleEvent(crash());
    await runner.handleEvent(crash());

    const body = vi.mocked(deps.notify).mock.calls.at(-1)?.[0].body ?? "";
    expect(body).toContain("Homeio stopped it");
    expect(body).toContain("restarted 1 times in 10 minutes");
  });

  it("counts crashes per app rather than globally", async () => {
    const apps = ["jellyfin", "nextcloud"];
    let index = 0;
    const { runner } = makeRunner({
      resolveAppId: vi.fn(async () => apps[index++ % apps.length]),
      loadHealth: vi.fn(async () => health("always", { maxRestarts: 5 })),
    });

    await runner.handleEvent(crash());
    await runner.handleEvent(crash());

    expect(runner.windowFor("jellyfin").count).toBe(1);
    expect(runner.windowFor("nextcloud").count).toBe(1);
  });

  it("still reports a crash it will not act on", async () => {
    const { runner, deps } = makeRunner({ loadHealth: vi.fn(async () => health("no")) });

    await runner.handleEvent(crash());

    expect(deps.restartApp).not.toHaveBeenCalled();
    expect(deps.recordState).toHaveBeenCalledWith(
      expect.objectContaining({ state: "unhealthy" }),
    );
  });

  it("keeps working when the restart itself fails", async () => {
    const { runner, deps } = makeRunner({
      restartApp: vi.fn(async () => {
        throw new Error("docker unreachable");
      }),
    });

    await expect(runner.handleEvent(crash())).resolves.toBeUndefined();
    expect(deps.recordState).toHaveBeenCalled();
  });
});
