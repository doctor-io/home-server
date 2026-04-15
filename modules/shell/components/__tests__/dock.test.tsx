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
    expect(appStoreButton.className).toContain("bg-primary/20");
    expect(terminalButton.className).toContain("bg-secondary/65");

    const runningDots = Array.from(container.querySelectorAll("span")).filter(
      (element) =>
        element.className.includes("h-[3px]") &&
        element.className.includes("w-4") &&
        element.className.includes("transition-colors") &&
        !element.className.includes("invisible"),
    );
    expect(runningDots).toHaveLength(2);
  });
});
