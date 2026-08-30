/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomAppSourceActions } from "@/modules/apps/components/custom-app-source-actions";

function mockCheck(payload: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, status, json: async () => payload });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("CustomAppSourceActions", () => {
  it("offers export as a direct download of the stored compose", () => {
    mockCheck({});
    render(<CustomAppSourceActions appId="custom-dockge" />);

    const link = screen.getByText("Export").closest("a") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/api/v1/store/custom-apps/custom-dockge/compose");
    expect(link.hasAttribute("download")).toBe(true);
  });

  it("says when the app still matches its source", async () => {
    mockCheck({ data: { changed: false, sourceUrl: "https://x/c.yml", lastImportedAt: null } });
    render(<CustomAppSourceActions appId="custom-dockge" />);

    fireEvent.click(screen.getByText("Check source"));

    await waitFor(() => expect(screen.getByText(/Up to date with its source/)).toBeTruthy());
  });

  it("explains what to do when the source has moved", async () => {
    mockCheck({ data: { changed: true, sourceUrl: "https://x/c.yml", lastImportedAt: null } });
    render(<CustomAppSourceActions appId="custom-dockge" />);

    fireEvent.click(screen.getByText("Check source"));

    await waitFor(() => expect(screen.getByText(/source has changed/)).toBeTruthy());
    // The next step matters more than the fact itself.
    expect(screen.getByText(/Import it again from the same URL/)).toBeTruthy();
  });

  it("does not pretend to check an app that was pasted", async () => {
    mockCheck({ error: "nothing to check", code: "not_imported" }, false, 409);
    render(<CustomAppSourceActions appId="custom-legacy" />);

    fireEvent.click(screen.getByText("Check source"));

    await waitFor(() => expect(screen.getByText(/pasted rather than imported/)).toBeTruthy());
  });

  it("surfaces a refusal from the fetch guards", async () => {
    mockCheck({ error: "That address is on a private network.", code: "private_host" }, false, 400);
    render(<CustomAppSourceActions appId="custom-lan" />);

    fireEvent.click(screen.getByText("Check source"));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("private network"),
    );
  });

  it("reports a dead server rather than hanging on Checking…", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<CustomAppSourceActions appId="custom-dockge" />);

    fireEvent.click(screen.getByText("Check source"));

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByText("Check source")).toBeTruthy();
  });
});
