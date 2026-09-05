import { describe, expect, it } from "vitest";
import {
  getAppVisualState,
  type AppItem,
} from "@/modules/apps/components/app-grid-presenters";

function appWith(status: AppItem["status"]): AppItem {
  return {
    id: "demo",
    name: "Demo",
    icon: () => null,
    logoUrl: null,
    color: "text-white",
    bgColor: "bg-black",
    status,
    category: "Other",
    webUiPort: null,
    containerName: null,
    updateAvailable: false,
  };
}

describe("getAppVisualState", () => {
  it("shows a stopped app as dimmed, with no alarm and no motion", () => {
    const state = getAppVisualState(appWith("stopped"));

    // Stopping an app is usually deliberate, so nothing here may read as an
    // alert: no red, no pulsing frame, no blinking dot, no warning badge.
    const classes = [
      state.containerClass,
      state.ringClass,
      state.dotInnerClass,
      state.badgeClass,
      state.imageClass,
    ].join(" ");

    expect(classes).not.toMatch(/status-red/);
    expect(classes).not.toMatch(/animate-/);
    expect(state.badgeIcon).toBeNull();
    expect(state.imageClass).toMatch(/grayscale/);
    expect(state.title).toBe("Stopped");
  });

  it("marks an unknown status without raising an alarm", () => {
    const state = getAppVisualState(appWith("unknown"));

    expect(state.badgeIcon).not.toBeNull();
    expect(`${state.badgeClass} ${state.ringClass}`).not.toMatch(/status-red/);
    expect(
      [state.containerClass, state.dotInnerClass, state.badgeIconClass].join(" "),
    ).not.toMatch(/animate-/);
  });

  it("leaves a running app unmarked", () => {
    const state = getAppVisualState(appWith("running"));

    expect(state.badgeIcon).toBeNull();
    expect(state.imageClass).toBe("");
    expect(state.title).toBe("Running");
  });
});
