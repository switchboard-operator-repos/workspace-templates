# @repo/extension-filesystem-hooks

Expose React Query hooks for the admin filesystem TRPC router. Call `createAdminFilesystemHooks(trpc.admin)` to get typed hooks for listing directories, reading files, and saving edits. The factory returns:

- `useFilesystemList`, `useFilesystemFile`, `useFilesystemSave`
- `getListQueryKey` / `getFileQueryKey`
- `invalidateFilesystemList` / `invalidateFilesystemFile`
- `createRefresher(queryClient, { getListInputs, intervalMs?, refetchOnWindowFocus? })` for centralized polling

UI layers should never hardcode query keys or timers—use these helpers so future admin views (tables, dashboards, etc.) inherit the same refresh behaviour.
