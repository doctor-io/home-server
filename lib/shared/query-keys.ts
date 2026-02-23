export const queryKeys = {
  systemMetrics: ["system", "metrics"] as const,
  installedApps: ["apps", "installed"] as const,
  currentUser: ["auth", "current-user"] as const,
  currentWeather: (latitude: number | null, longitude: number | null) =>
    ["weather", "current", latitude, longitude] as const,
};
