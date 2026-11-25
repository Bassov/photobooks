## Decisions

1. **404 in the Worker.** With the SPA fallback, Cloudflare routes non-navigation misses to the Worker, which forwarded them to `env.ASSETS.fetch` (index.html). Now an HTML answer under `/assets/*` becomes 404 (`no-store`); other paths keep index.html. Security: no new headers, CSP unchanged.
2. **Pure reload-once guard** (`src/lib/staleChunkReload.ts`): save, write a sessionStorage timestamp, reload; decline within 60 s of the last mark, on a failed save, or when storage throws.
3. **Save first** via the existing awaitable pre-release flush; no library means no save, so no auto reload.
4. **One recovery, two entry points:** a `vite:preloadError` listener (no `preventDefault`) and an error boundary around the lazy Site preview. Its fallback reuses `SitePreviewFrame` (Back, Esc, focus trap) with the `Button` primitive and `SUB` token; a failed save asks "Reload anyway".
5. **Other callers:** workers already handle `error`; other editor dynamic imports are folded into the main chunk; site and PDF imports run outside the editor.

## Touch-set & Test Plan

| Path                                     |
| ---------------------------------------- |
| `src/worker/index.ts`                    |
| `src/worker/cfRelay.test.ts`             |
| `src/lib/staleChunkReload.ts`            |
| `src/lib/staleChunkReload.test.ts`       |
| `src/editor/staleChunkSession.ts`        |
| `src/editor/staleChunkSession.test.ts`   |
| `src/editor/StaleChunkBoundary.tsx`      |
| `src/editor/StaleChunkBoundary.test.tsx` |
| `src/editor/EditorShell.tsx`             |
| `src/editor/projectSession.ts`           |
| `src/editor/projectSession.test.ts`      |
| `e2e/stale-chunk.spec.ts`                |

- Unit: guard, listener, boundary phases, Worker 404 vs SPA fallback.
- e2e: session book → Reload error, Esc back; library book → one reload, then Reload error, no loop. Skill `ui-review`.
