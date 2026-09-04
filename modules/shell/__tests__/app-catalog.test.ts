import { describe, expect, it } from "vitest";

import {
  DESKTOP_WINDOWS,
  DESKTOP_WINDOWS_BY_ID,
  DOCK_APPS,
} from "@/modules/shell/app-catalog";

describe("desktop app catalog", () => {
  it("declares every window id exactly once", () => {
    const ids = DESKTOP_WINDOWS.map((spec) => spec.id);

    expect(ids).toEqual([...new Set(ids)]);
  });

  it("declares every dock id exactly once", () => {
    const ids = DOCK_APPS.map((app) => app.id);

    expect(ids).toEqual([...new Set(ids)]);
  });

  it("indexes every window", () => {
    expect([...DESKTOP_WINDOWS_BY_ID.keys()]).toEqual(
      DESKTOP_WINDOWS.map((spec) => spec.id),
    );
  });

  it("only docks apps that open a window, apart from the home grid", () => {
    const windowIds = new Set(DESKTOP_WINDOWS.map((spec) => spec.id));
    const orphans = DOCK_APPS.filter(
      (app) => app.id !== "apps" && !windowIds.has(app.id),
    ).map((app) => app.id);

    expect(orphans).toEqual([]);
  });

  it("gives every window a non-empty title and command subtitle", () => {
    const incomplete = DESKTOP_WINDOWS.filter(
      (spec) => !spec.title.trim() || !spec.commandSubtitle.trim(),
    ).map((spec) => spec.id);

    expect(incomplete).toEqual([]);
  });
});
