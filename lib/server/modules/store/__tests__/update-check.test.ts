import { describe, expect, it } from "vitest";

import {
  compareImageTags,
  extractImageTag,
  isTagUpdateAvailable,
} from "@/lib/server/modules/store/update-check";

describe("update-check (tag-based)", () => {
  describe("extractImageTag", () => {
    it("extracts tag from image with repo prefix", () => {
      expect(extractImageTag("plexinc/pms-docker:1.41.3")).toBe("1.41.3");
    });

    it("extracts tag from simple image", () => {
      expect(extractImageTag("nginx:1.25.3")).toBe("1.25.3");
    });

    it("returns null for image with no tag", () => {
      expect(extractImageTag("nginx")).toBeNull();
    });

    it("returns null for null/undefined input", () => {
      expect(extractImageTag(null)).toBeNull();
      expect(extractImageTag(undefined)).toBeNull();
    });
  });

  describe("compareImageTags", () => {
    it("returns positive when a is greater", () => {
      expect(compareImageTags("1.41.3", "1.41.2")).toBeGreaterThan(0);
      expect(compareImageTags("2026.3.0", "2025.2.1")).toBeGreaterThan(0);
    });

    it("returns negative when a is less", () => {
      expect(compareImageTags("1.41.2", "1.41.3")).toBeLessThan(0);
      expect(compareImageTags("2025.2.1", "2026.3.0")).toBeLessThan(0);
    });

    it("returns 0 when equal", () => {
      expect(compareImageTags("1.41.2", "1.41.2")).toBe(0);
    });

    it("compares by major version first", () => {
      expect(compareImageTags("2.0.0", "1.99.99")).toBeGreaterThan(0);
    });
  });

  describe("isTagUpdateAvailable", () => {
    it("returns true when catalog tag is strictly newer", () => {
      expect(isTagUpdateAvailable("plexinc/pms-docker:1.41.2", "plexinc/pms-docker:1.41.3")).toBe(true);
      expect(isTagUpdateAvailable("wisdomsky/cloudflared-web:2025.2.1", "wisdomsky/cloudflared-web:2026.3.0")).toBe(true);
    });

    it("returns false when catalog tag is older than installed", () => {
      // Catalog lags behind installed — should NOT show as update
      expect(isTagUpdateAvailable("wisdomsky/cloudflared-web:2026.3.0", "wisdomsky/cloudflared-web:2025.2.1")).toBe(false);
    });

    it("returns false when tags are equal", () => {
      expect(isTagUpdateAvailable("nginx:1.25.3", "nginx:1.25.3")).toBe(false);
    });

    it("returns false when either image is null", () => {
      expect(isTagUpdateAvailable(null, "nginx:1.25.3")).toBe(false);
      expect(isTagUpdateAvailable("nginx:1.25.3", null)).toBe(false);
      expect(isTagUpdateAvailable(null, null)).toBe(false);
    });

    it("returns false when images have no tags", () => {
      expect(isTagUpdateAvailable("nginx", "nginx")).toBe(false);
    });
  });
});
