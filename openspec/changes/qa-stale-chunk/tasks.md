## Implementation

- [x] 1. Worker: missing `/assets/*` → 404, SPA routes unchanged (`src/worker/cfRelay.test.ts` "with the SPA fallback of the assets binding").
- [x] 2. Reload-once guard `src/lib/staleChunkReload.ts` (`src/lib/staleChunkReload.test.ts`).
- [x] 3. `flushBeforeReload` in `projectSession` (`src/editor/projectSession.test.ts`).
- [x] 4. `vite:preloadError` listener + shared recovery (`src/editor/staleChunkSession.test.ts`).
- [x] 5. `StaleChunkBoundary` around the lazy Site preview (`src/editor/StaleChunkBoundary.test.tsx`, `e2e/stale-chunk.spec.ts`).

## Manual test scenarios

1. Session editor, stale `SitePreview-*.js` served as text/html: Preview → "Reload" error over the editor, Esc returns to the editor.
2. Library book, same stale chunk: Preview → one reload; again → "Reload" error, no further reload.
