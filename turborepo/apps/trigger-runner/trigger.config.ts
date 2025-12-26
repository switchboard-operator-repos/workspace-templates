import { syncEnvVars } from "@trigger.dev/build/extensions/core";
import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF!,
  dirs: ["./src/tasks"],
  build: {
    extensions: [
      syncEnvVars(async (_ctx) => {
        const sourceEnv = process.env;
        const envVars: Array<{ name: string; value: string }> = [];

        for (const [name, value] of Object.entries(sourceEnv)) {
          if (typeof value !== "string") {
            continue;
          }

          envVars.push({ name, value });
        }

        return envVars;
      }),
    ],
  },
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10_000,
      factor: 2,
      randomize: true,
    },
  },
  maxDuration: 4 * 3600,
});
