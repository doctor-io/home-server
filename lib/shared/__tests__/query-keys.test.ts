import { describe, expect, it } from "vitest";
import { queryKeys } from "@/lib/shared/query-keys";

describe("query keys", () => {
  it("exports stable cache keys", () => {
    expect(queryKeys.systemMetrics).toEqual(["system", "metrics"]);
    expect(queryKeys.networkStatus).toEqual(["network", "status"]);
    expect(queryKeys.networkNetworks).toEqual(["network", "networks"]);
    expect(queryKeys.installedApps).toEqual(["apps", "installed"]);
    expect(queryKeys.currentUser).toEqual(["auth", "current-user"]);
    expect(queryKeys.storeCatalog).toEqual(["store", "catalog"]);
    expect(queryKeys.storeApp("adguard-home")).toEqual([
      "store",
      "app",
      "adguard-home",
    ]);
    expect(queryKeys.storeOperation("op-1")).toEqual([
      "store",
      "operation",
      "op-1",
    ]);
    expect(queryKeys.currentWeather(1, 2)).toEqual(["weather", "current", 1, 2]);
  });
});
