/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HealthPolicyCard } from "@/modules/apps/components/health-policy-card";

function health(overrides: Record<string, unknown> = {}) {
  return {
    appId: "jellyfin",
    policy: "no",
    maxRestarts: 5,
    windowMinutes: 10,
    state: "unknown",
    restartCount: 0,
    windowStartedAt: null,
    lastTransitionAt: null,
    mutedUntil: null,
    ...overrides,
  };
}

function mockApi(initial: Record<string, unknown>, ok = true) {
  const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => ({
      data: init?.method === "PUT" ? { ...initial, ...JSON.parse(init.body as string) } : initial,
    }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function putBodies(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === "PUT")
    .map(([, init]) => JSON.parse((init as RequestInit).body as string));
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("HealthPolicyCard", () => {
  it("offers every policy Docker defines, by name", async () => {
    mockApi(health());
    render(<HealthPolicyCard appId="jellyfin" />);

    await waitFor(() => expect(screen.getByLabelText("Restart policy")).toBeTruthy());
    const options = Array.from(
      (screen.getByLabelText("Restart policy") as HTMLSelectElement).options,
    ).map((option) => option.value);

    expect(options).toEqual(["no", "on-failure", "always", "unless-stopped"]);
  });

  it("explains what the selected policy does", async () => {
    mockApi(health({ policy: "unless-stopped" }));
    render(<HealthPolicyCard appId="jellyfin" />);

    await waitFor(() =>
      expect(screen.getByText(/a container you stopped stays stopped/i)).toBeTruthy(),
    );
  });

  it("hides the restart budget while the policy never restarts", async () => {
    mockApi(health({ policy: "no" }));
    render(<HealthPolicyCard appId="jellyfin" />);

    await waitFor(() => expect(screen.getByLabelText("Restart policy")).toBeTruthy());
    expect(screen.queryByLabelText("Give up after")).toBeNull();

    fireEvent.change(screen.getByLabelText("Restart policy"), { target: { value: "always" } });

    expect(screen.getByLabelText("Give up after")).toBeTruthy();
  });

  it("saves the chosen policy with its budget", async () => {
    const fetchMock = mockApi(health());
    render(<HealthPolicyCard appId="jellyfin" />);

    await waitFor(() => expect(screen.getByLabelText("Restart policy")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Restart policy"), {
      target: { value: "on-failure" },
    });
    fireEvent.click(screen.getByText("Save policy"));

    await waitFor(() => expect(putBodies(fetchMock)).toHaveLength(1));
    expect(putBodies(fetchMock)[0]).toMatchObject({
      policy: "on-failure",
      maxRestarts: 5,
      windowMinutes: 10,
    });
  });

  it("mutes for 24 hours, and offers to resume once muted", async () => {
    const fetchMock = mockApi(health({ policy: "always" }));
    render(<HealthPolicyCard appId="jellyfin" />);

    await waitFor(() => expect(screen.getByText("Mute for 24 h")).toBeTruthy());
    fireEvent.click(screen.getByText("Mute for 24 h"));

    await waitFor(() => expect(screen.getByText("Resume auto-heal")).toBeTruthy());
    expect(typeof putBodies(fetchMock)[0].mutedUntil).toBe("string");
  });

  it("clears the mute when resuming", async () => {
    const muted = new Date(Date.now() + 3_600_000).toISOString();
    const fetchMock = mockApi(health({ policy: "always", mutedUntil: muted }));
    render(<HealthPolicyCard appId="jellyfin" />);

    await waitFor(() => expect(screen.getByText("Resume auto-heal")).toBeTruthy());
    fireEvent.click(screen.getByText("Resume auto-heal"));

    await waitFor(() => expect(putBodies(fetchMock)).toHaveLength(1));
    expect(putBodies(fetchMock)[0].mutedUntil).toBeNull();
  });

  it("reports the observed state rather than the configured one", async () => {
    mockApi(health({ policy: "always", state: "stopped_by_policy", restartCount: 4 }));
    render(<HealthPolicyCard appId="jellyfin" />);

    await waitFor(() =>
      expect(screen.getByText("Stopped after repeated crashes")).toBeTruthy(),
    );
    expect(screen.getByText(/4 restarts counted/)).toBeTruthy();
  });

  it("says so when the policy cannot be read", async () => {
    mockApi(health(), false);
    render(<HealthPolicyCard appId="jellyfin" />);

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  });
});
