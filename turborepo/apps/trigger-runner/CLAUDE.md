# Trigger Runner App

- If you are creating new trigger tasks, ensure they live inside of `packages/trigger`. Do **not** put the full implementation inside of `apps/trigger-runner`
- Make sure all your new tasks are exported from `apps/trigger-runner/src/tasks/index.ts`
- The dev server uses `apps/trigger-runner/src/tasks/index.ts` to determine what tasks it should load.
- `apps/trigger-runner/trigger.config.ts` is the main configuration file for the Trigger project
  - `dirs` controls where tasks are loaded from.
  - `retries` controls the default retry strategy for tasks (and whether they are enabled in dev mode).
  - `maxDuration` controls the overall timeout for tasks when running in dev.

## Deployment

- The `trigger deploy` command is what deploys new task versions into the Trigger cloud.
- Make sure you read the deployment portion of the documentation any time you modify the trigger config.
