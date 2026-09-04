import { describe, expect, it } from "vitest";

import {
  SETTINGS_SECTION_GROUPS,
  SETTINGS_SECTION_IDS,
  SETTINGS_SECTIONS,
} from "@/modules/settings/components/panel/catalog";

describe("settings section catalog", () => {
  it("declares every section id exactly once", () => {
    const ids = SETTINGS_SECTIONS.map((section) => section.id);

    expect(ids).toEqual([...new Set(ids)]);
  });

  it("declares every group id exactly once", () => {
    const ids = SETTINGS_SECTION_GROUPS.map((group) => group.id);

    expect(ids).toEqual([...new Set(ids)]);
  });

  it("puts every section in a declared group", () => {
    const groupIds = new Set(SETTINGS_SECTION_GROUPS.map((group) => group.id));
    const orphans = SETTINGS_SECTIONS.filter(
      (section) => !groupIds.has(section.group),
    ).map((section) => section.id);

    expect(orphans).toEqual([]);
  });

  it("keeps SETTINGS_SECTION_IDS in sync with the catalog", () => {
    expect(SETTINGS_SECTION_IDS).toEqual(
      SETTINGS_SECTIONS.map((section) => section.id),
    );
  });
});
