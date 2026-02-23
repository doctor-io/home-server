import { describe, expectTypeOf, it } from "vitest";
import type { InstalledApp } from "@/lib/shared/contracts/apps";
import type { SystemMetricsSnapshot } from "@/lib/shared/contracts/system";
import type { WeatherSnapshot } from "@/lib/shared/contracts/weather";

describe("shared contracts", () => {
  it("exposes typed runtime contracts", () => {
    expectTypeOf<InstalledApp>().toMatchTypeOf<{
      id: string;
      name: string;
      status: "running" | "stopped" | "unknown";
      updatedAt: string;
    }>();

    expectTypeOf<SystemMetricsSnapshot>().toMatchTypeOf<{
      timestamp: string;
      hostname: string;
      platform: string;
      uptimeSeconds: number;
      temperature: {
        mainCelsius: number | null;
      };
      battery: {
        hasBattery: boolean;
      };
      wifi: {
        connected: boolean;
      };
    }>();

    expectTypeOf<WeatherSnapshot>().toMatchTypeOf<{
      source: "navigator" | "ip";
      location: {
        label: string;
      };
      current: {
        condition: string;
      };
    }>();
  });
});
