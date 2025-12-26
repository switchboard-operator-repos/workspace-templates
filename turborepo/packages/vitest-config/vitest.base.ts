import tsconfigPaths from "vite-tsconfig-paths";
import {
  defineConfig,
  mergeConfig,
  type UserConfigExport,
} from "vitest/config";

const base = defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx,js,jsx}"],
    exclude: ["node_modules", "dist", ".turbo", "e2e/**"],
    // "node" for libraries; override to "jsdom" in UI packages
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      exclude: ["**/*.{test,spec}.*", "**/vitest.setup.*"],
    },
  },
});

export function extendVitestConfig(
  overrides: UserConfigExport = {}
): UserConfigExport {
  return mergeConfig(base, defineConfig(overrides));
}

export default base;
