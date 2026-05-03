/* @vitest-environment jsdom */

import { Dock } from "@/modules/shell/components/dock";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("Dock", () => {
  it("highlights only the focused app while keeping running indicators for open apps", () => {
    const { container } = render(
      <Dock
        activeWindows={["terminal", "app-store"]}
        focusedWindow="app-store"
        animationsEnabled={false}
      />,
    );

    const terminalButton = screen.getByRole("button", { name: "Terminal" });
    const appStoreButton = screen.getByRole("button", { name: "App Store" });

    expect(appStoreButton.getAttribute("aria-pressed")).toBe("true");
    expect(terminalButton.getAttribute("aria-pressed")).toBe("false");
    // focused state is expressed as a ring shadow on the inner icon element
    const appStoreIcon = appStoreButton.querySelector("img, [class*='rounded-2xl']");
    const terminalIcon = terminalButton.querySelector("img, [class*='rounded-2xl']");
    expect(appStoreIcon?.className).toContain("shadow-[0_0_0_2px_hsl(var(--primary)");
    expect(terminalIcon?.className).not.toContain("shadow-[0_0_0_2px_hsl(var(--primary)");

    const runningDots = Array.from(container.querySelectorAll("span")).filter(
      (element) =>
        element.className.includes("rounded-full") &&
        element.className.includes("h-[3px]") &&
        element.className.includes("transition-all") &&
        !element.className.includes("invisible"),
    );
    expect(runningDots).toHaveLength(2);
    expect(runningDots.some((element) => element.className.includes("w-4"))).toBe(
      true,
    );
    expect(
      runningDots.some((element) => element.className.includes("w-2.5")),
    ).toBe(true);
  });
});
