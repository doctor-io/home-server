import { describe, expect, it, vi } from "vitest";
import { LruCache } from "@/lib/server/cache/lru";

describe("LruCache", () => {
  it("returns cached values before ttl", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-22T00:00:00.000Z"));

    const cache = new LruCache<number>(2, 1000);
    cache.set("a", 1);

    expect(cache.get("a")).toBe(1);

    vi.useRealTimers();
  });

  it("expires entries after ttl", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-22T00:00:00.000Z"));

    const cache = new LruCache<number>(2, 1000);
    cache.set("a", 1);

    vi.advanceTimersByTime(1001);

    expect(cache.get("a")).toBeNull();

    vi.useRealTimers();
  });

  it("evicts least recently used when max entries is reached", () => {
    const cache = new LruCache<number>(2, 10000);

    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a");
    cache.set("c", 3);

    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBeNull();
    expect(cache.get("c")).toBe(3);
  });
});
