/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseResolvedWallpaper = vi.fn();

vi.mock("@/modules/shell/hooks/useResolvedWallpaper", () => ({
  useResolvedWallpaper: () => mockUseResolvedWallpaper(),
}));

import { FullScreenShell } from "@/modules/shell/components/full-screen-shell";

describe("FullScreenShell", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-13T08:25:00.000Z"));
    mockUseResolvedWallpaper.mockReturnValue({
      wallpaper: "/images/8.jpg",
      isHydrated: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("applies wallpaper and renders all slots", () => {
    render(
      <FullScreenShell
        center={<div>Center Content</div>}
        bottom={<div>Bottom Content</div>}
        topRight={<button type="button">Top Action</button>}
      />,
    );

    expect(screen.getByTestId("full-screen-shell")).toBeTruthy();
    expect(screen.getByText("Center Content")).toBeTruthy();
    expect(screen.getByText("Bottom Content")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Top Action" })).toBeTruthy();
    expect(
      (screen.getByTestId("full-screen-wallpaper") as HTMLDivElement).style
        .backgroundImage,
    ).toContain("/images/8.jpg");
  });

  it("renders the shared clock area by default", () => {
    render(<FullScreenShell center={<div>Center</div>} />);

    const now = new Date("2026-03-13T08:25:00.000Z");
    expect(
      screen.getByText(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        now.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
      ),
    ).toBeTruthy();
  });
});
