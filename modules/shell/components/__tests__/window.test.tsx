/* @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Window } from "@/modules/shell/components/window";

describe("Window", () => {
  it("maximizes into the desktop area above a bottom dock", () => {
    render(
      <Window
        title="App Store"
        onClose={() => {}}
        dockPosition="bottom"
        animationsEnabled={false}
      >
        <div>content</div>
      </Window>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Maximize window" }));

    const container = screen.getByText("content").closest("div.absolute");
    expect(container).toBeTruthy();
    expect(container?.getAttribute("style")).toContain("top: 0px");
    expect(container?.getAttribute("style")).toContain("right: 0px");
    expect(container?.getAttribute("style")).toContain("bottom: 88px");
    expect(container?.getAttribute("style")).toContain("left: 0px");
  });

  it("maximizes around a side dock", () => {
    render(
      <Window
        title="Monitor"
        onClose={() => {}}
        dockPosition="left"
        animationsEnabled={false}
      >
        <div>monitor</div>
      </Window>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Maximize window" }));

    const container = screen.getByText("monitor").closest("div.absolute");
    expect(container).toBeTruthy();
    expect(container?.getAttribute("style")).toContain("top: 0px");
    expect(container?.getAttribute("style")).toContain("right: 0px");
    expect(container?.getAttribute("style")).toContain("bottom: 0px");
    expect(container?.getAttribute("style")).toContain("left: 80px");
  });
});
