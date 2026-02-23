import { describe, expect, it } from "vitest";
import { queryKeys } from "@/lib/shared/query-keys";

describe("query keys", () => {
  it("exports stable cache keys", () => {
    expect(queryKeys.systemMetrics).toEqual(["system", "metrics"]);
    expect(queryKeys.installedApps).toEqual(["apps", "installed"]);
    expect(queryKeys.currentUser).toEqual(["auth", "current-user"]);
    expect(queryKeys.currentWeather(1, 2)).toEqual(["weather", "current", 1, 2]);
  });
});
