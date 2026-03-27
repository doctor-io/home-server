import { describe, expect, it } from "vitest";
import {
  APPEARANCE_RADIUS_MAX,
  APPEARANCE_RADIUS_MIN,
  DEFAULT_APPEARANCE_SETTINGS,
  sanitizeAppearanceSettings,
} from "@/lib/desktop/appearance";

describe("sanitizeAppearanceSettings", () => {
  it("forces legacy system theme values to dark", () => {
    expect(
      sanitizeAppearanceSettings({
        theme: "system",
      }).theme,
    ).toBe("dark");
  });

  it("clamps radius values into the supported range", () => {
    expect(
      sanitizeAppearanceSettings({
        radius: APPEARANCE_RADIUS_MIN - 10,
      }).radius,
    ).toBe(APPEARANCE_RADIUS_MIN);

    expect(
      sanitizeAppearanceSettings({
        radius: APPEARANCE_RADIUS_MAX + 10,
      }).radius,
    ).toBe(APPEARANCE_RADIUS_MAX);

    expect(
      sanitizeAppearanceSettings({
        radius: "12",
      }).radius,
    ).toBe(DEFAULT_APPEARANCE_SETTINGS.radius);
  });
});
