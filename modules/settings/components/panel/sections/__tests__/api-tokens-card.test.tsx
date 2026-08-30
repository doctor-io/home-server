/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiTokensCard } from "@/modules/settings/components/panel/sections/api-tokens-card";

function token(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    name: "Home Assistant",
    prefix: "homeio_ab12",
    scopes: ["read:metrics"],
    expiresAt: null,
    lastUsedAt: null,
    lastUsedIp: null,
    createdAt: new Date().toISOString(),
    revokedAt: null,
    ...overrides,
  };
}

function mockApi(list: unknown[], created?: unknown) {
  const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => ({
    ok: true,
    status: 200,
    json: async () =>
      init?.method === "POST" ? { data: created } : { data: list },
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("ApiTokensCard", () => {
  it("says what tokens are for when there are none", async () => {
    mockApi([]);
    render(<ApiTokensCard />);

    await waitFor(() => expect(screen.getByText(/Home Assistant, n8n or a script/)).toBeTruthy());
  });

  it("shows the prefix and scopes, never a full token", async () => {
    mockApi([token()]);
    render(<ApiTokensCard />);

    await waitFor(() => expect(screen.getByText(/homeio_ab12…/)).toBeTruthy());
    expect(screen.getByText(/read:metrics/)).toBeTruthy();
  });

  it("reveals a created token once, with a way to acknowledge it", async () => {
    mockApi([], { ...token(), token: "homeio_secretvalue123" });
    render(<ApiTokensCard />);

    await waitFor(() => expect(screen.getByText("New token")).toBeTruthy());
    fireEvent.click(screen.getByText("New token"));
    fireEvent.change(screen.getByLabelText("Token name"), { target: { value: "HA" } });
    fireEvent.click(screen.getByText("Create token"));

    await waitFor(() => expect(screen.getByText("homeio_secretvalue123")).toBeTruthy());
    expect(screen.getByText(/not shown again/)).toBeTruthy();

    fireEvent.click(screen.getByText("I have saved it"));
    expect(screen.queryByText("homeio_secretvalue123")).toBeNull();
  });

  it("will not create a token with no name", async () => {
    mockApi([]);
    render(<ApiTokensCard />);

    await waitFor(() => expect(screen.getByText("New token")).toBeTruthy());
    fireEvent.click(screen.getByText("New token"));

    expect((screen.getByText("Create token") as HTMLButtonElement).disabled).toBe(true);
  });

  it("will not create a token with no scopes", async () => {
    mockApi([]);
    render(<ApiTokensCard />);

    await waitFor(() => expect(screen.getByText("New token")).toBeTruthy());
    fireEvent.click(screen.getByText("New token"));
    fireEvent.change(screen.getByLabelText("Token name"), { target: { value: "HA" } });
    // read:metrics is on by default; turning it off leaves none selected.
    fireEvent.click(screen.getByLabelText("Read system metrics"));

    expect((screen.getByText("Create token") as HTMLButtonElement).disabled).toBe(true);
  });

  it("warns before granting power, in terms of what it costs", async () => {
    mockApi([]);
    render(<ApiTokensCard />);

    await waitFor(() => expect(screen.getByText("New token")).toBeTruthy());
    fireEvent.click(screen.getByText("New token"));
    fireEvent.click(screen.getByLabelText("Shut down and restart the server"));

    expect(screen.getByText(/take it offline/)).toBeTruthy();
  });

  it("does not warn about power when it was not asked for", async () => {
    mockApi([]);
    render(<ApiTokensCard />);

    await waitFor(() => expect(screen.getByText("New token")).toBeTruthy());
    fireEvent.click(screen.getByText("New token"));

    expect(screen.queryByText(/take it offline/)).toBeNull();
  });

  it("flags a token nobody has used in 90 days", async () => {
    const old = new Date(Date.now() - 200 * 86_400_000).toISOString();
    mockApi([token({ createdAt: old })]);
    render(<ApiTokensCard />);

    await waitFor(() => expect(screen.getByText("Unused 90 days")).toBeTruthy());
  });

  it("offers no revoke button for an already revoked token", async () => {
    mockApi([token({ revokedAt: new Date().toISOString() })]);
    render(<ApiTokensCard />);

    await waitFor(() => expect(screen.getByText("Revoked")).toBeTruthy());
    expect(screen.queryByText("Revoke")).toBeNull();
  });

  it("revokes a token", async () => {
    const fetchMock = mockApi([token()]);
    render(<ApiTokensCard />);

    await waitFor(() => expect(screen.getByText("Revoke")).toBeTruthy());
    fireEvent.click(screen.getByText("Revoke"));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            url === "/api/v1/auth/tokens/t1" && (init as RequestInit).method === "DELETE",
        ),
      ).toBe(true),
    );
  });
});
