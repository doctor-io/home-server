import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["lcov", "text-summary"],
      reportsDirectory: "./coverage",
      reportOnFailure: true,
      exclude: [
        "node_modules/**",
        ".next/**",
        "dist-server/**",
        "coverage/**",
        "**/*.test.ts",
        "**/*.test.tsx",
        "test/**",
        "drizzle/**",
        "packages/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
