import { extendVitestConfig } from "@repo/vitest-config";
import tsconfigPaths from "vite-tsconfig-paths";

export default extendVitestConfig({
  plugins: [tsconfigPaths({ projects: ["./tsconfig.json"] })],
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "*.config.ts",
        "src/client.ts",
        "src/index.ts",
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        statements: 95,
        branches: 90,
      },
    },
  },
});
