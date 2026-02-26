export const queryKeys = {
  systemMetrics: ["system", "metrics"] as const,
  networkStatus: ["network", "status"] as const,
  networkNetworks: ["network", "networks"] as const,
  installedApps: ["apps", "installed"] as const,
  currentUser: ["auth", "current-user"] as const,
  storeCatalog: ["store", "catalog"] as const,
  storeApp: (appId: string) => ["store", "app", appId] as const,
  storeOperation: (operationId: string) =>
    ["store", "operation", operationId] as const,
  filesList: (filePath: string) => ["files", "list", filePath] as const,
  fileContent: (filePath: string) => ["files", "content", filePath] as const,
  networkShares: ["files", "network", "shares"] as const,
  trashEntries: (filePath: string) => ["files", "trash", "entries", filePath] as const,
  currentWeather: (latitude: number | null, longitude: number | null) =>
    ["weather", "current", latitude, longitude] as const,
};
