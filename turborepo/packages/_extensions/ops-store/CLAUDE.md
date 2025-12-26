# @repo/extension-ops-store

Git-friendly storage for admin ops runs. Uses `@repo/extension-fs-db` collections under `data/admin/command-runs`.

## Exports
- `RunRecordSchema`, `RunRecord` — zod schema + type.
- `commandRuns` — JsonCollection for run records.
- `buildRunRecord(runResult, scriptName?)` — converts a `CommandResult` into a record with an `id`.
- `saveRun(record)` — persists a record (id used as filename).

## Path convention
Files live at `data/admin/command-runs/<id>.json` relative to repo root, so diffs stay small and reviewable.
