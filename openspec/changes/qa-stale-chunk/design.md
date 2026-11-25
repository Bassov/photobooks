## Decisions

1. **404 in the Worker, not config.** With `not_found_handling: single-page-application` Cloudflare already sends non-navigation misses to the Worker; it forwarded them to `env.ASSETS.fetch`, which applied the SPA fallback. The Worker now turns an HTML answer for `/assets/*` into `404` (`Cache-Control: no-store`); other paths are unchanged, so SPA routes keep index.html.
2. **Pure guard in `src/lib/staleChunkReload.ts`.** `createStaleChunkRecovery({ storage, now, flush, reload })`: `recover()` (memoized per page) saves, writes a sessionStorage timestamp, reloads; declines within 60 s of the last mark, on a failed save, or when storage throws. `reloadNow(discardUnsaved)` is the user's button.
3. **Save first.** `projectSession.flushBeforeReload()` wraps the existing awaitable `flushPendingSaveBeforeRelease`; it returns false without a library (a session book cannot survive a reload).
4. **Two entry points, one recovery.** A `vite:preloadError` listener (installed by `EditorShell`, no `preventDefault`) and `StaleChunkBoundary` around the lazy `SitePreview` share the singleton from `src/editor/staleChunkSession.ts`.
5. **Fallback UI reuses `SitePreviewFrame`** (Back + Esc, focus trap) with the `Button` primitive and `SUB` chrome text token: "Updating Photobooks…" while reloading, else a message and Reload; a failed save turns it into a destructive "Reload anyway".
6. **Other callers:** workers already handle `error`; the 404 makes a stale worker URL fail fast. `projectSession` dynamic imports are folded into the main chunk (rolldown INEFFECTIVE_DYNAMIC_IMPORT); `src/site/*` imports run in the exported site, not the editor; PDF/fontkit imports run inside workers.

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

- Reuse: `SitePreviewFrame`, `Button`, `flushPendingSaveBeforeRelease`.
- Unit: guard (once / window / garbage mark / failed save / throwing storage / manual), listener, boundary phases, Worker 404 vs SPA fallback.
- e2e: session book → Reload error, no reload, Esc back; library book → one reload, then Reload error, no loop; `presentation-mode` unchanged.
