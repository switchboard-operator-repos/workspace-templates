# @repo/extension-preview-state

Lightweight client helpers for extension iframes to stay in sync with the primary app's location. Designed for the meta shell that passes the active app path via query params and postMessage.

## Contract
- The meta shell appends `?previewPath=/some/route` to the extension iframe URL.
- It may also send `window.postMessage({ type: "preview-path", path: "/some/route" }, "*")` when the app path changes.

## Exports
- `getPreviewPathFromLocation(location?: Location)` — reads `previewPath` (or `preview_path`) search param.
- `usePreviewPath(initial?: string)` — React hook that returns the latest preview path, updates on `popstate` and `message` events, and falls back to the query param.
- `usePreviewPathMatch(prefix: string)` — returns an object `{ matches, remainder }` for simple prefix-based matching.

## Notes
- No Next.js/React imports outside the hooks (safe for server bundle tree shaking).
- If neither query nor messages provide a value, hooks return `null`.
