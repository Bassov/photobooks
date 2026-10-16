# Design

## Goals / Non-Goals

**Goals:** Correct returning-user loop — leave editor, correct re-grant, no duplicate recents, visible IDB errors, no races, clean New library, readable errors.

**Non-Goals:** Book titles; a11y/LHCI/HomeScreen RTL/mutation polish (`recents-home-quality`); missing-assets; M3.

## Decisions

1. **Home control** — Release lock → clear `sessionStorage` active book id → home. Reload without that id → home.

2. **Restore loading** — Snapshot exposes `restorePending: true` until `tryRestore` settles (App/HomeScreen disable all home actions while pending). Failure clears stale ids + library binding → home. Notify subscribers on every surface change.

3. **Re-grant** — Store `pendingRegrantLibraryId` + `pendingRegrantBookId`. Prefer `requestPermission` on stored handle; picker fallback requires `isSameEntry`; mismatch / Don't Allow → home message, no bind. Success opens pending book.

4. **Dedup seam** — Add `peekLibraryHandle(libraryId)` on SessionState: returns the opaque stored handle **without** checking permission (or `not-found`). `resolveLibraryIdForHandle` peeks every recent id and runs `isSameEntry` against those handles. Permission-gated `recallLibraryHandle` stays for open/list. Cap 10; `removeRecentLibrary`; extend `SessionIdb` with a multi-key `runReadwrite` helper so remember/clear/remove+recents share one transaction.

5. **Home errors** — Catch list/create/open/grant; error state + Retry; typed API without throwing; human-readable map.

6. **Busy** — Serialize New / Open / Grant / open-book / Home through existing projectSession busy; do not steal focus when disabling.

7. **New library while open** — Release current book; do not write previous `book.json`; empty book in new folder; filmstrip from new folder.

8. **`__recents` / `__active`** — Reserved; reject as library ids. Write `__active` on success; read on home to preselect last library.

9. **Test hooks** — `exposeProjectSessionTestApi` only when `import.meta.env.DEV` or compile-time `VITE_E2E` (Playwright preview build); optional runtime `__photobooksE2e`.

## Module boundaries

- `src/project/session/*` — IDB, recents, peek/remember/clear/remove, reserved keys, locks (no React).
- `projectSession.ts` — Home/re-grant/busy/restore orchestration, human-readable errors (no FSA picker calls inside React components beyond thin button handlers).
- `HomeScreen.tsx` / `EditorShell.tsx` — thin UI over snapshot + actions.

## Touch-set

- `src/project/session/{types,idb,browserSessionState,memorySessionState,recents}.ts`
- `src/editor/projectSession.ts`, `HomeScreen.tsx`, `EditorShell.tsx`, `App.tsx`
- Unit: peek/dedup, re-grant, restore-fail, reserved keys
- E2e: extend `e2e/recents-home.spec.ts` — Home button; same-folder no duplicate; IDB-blocked error when feasible; keep `assertDocumentFitsViewport` / `assertNamedScrollport('home-scroll')`
- Before push: skill `ui-review` on home empty / error / permission / happy / Home back

## Security

- Directory handles stay opaque on SessionState; never expose raw IDB keys to UI.
- Re-grant never replaces a recent with a picker folder unless `isSameEntry` confirms identity.
- Permission denial / Don't Allow → typed failure and visible message, not silent success.
- Test session-replace hooks absent from production builds.

## Alternatives

- Picker-first re-grant — rejected.
- Dedup only among granted recalls — rejected (duplicates after restart).

## Risks

- Cap 10; Chromium `isSameEntry` without permission.
- PR already large; quality follow-up owns a11y/LHCI/RTL suite.

## Migration

- Existing handles unchanged; cap on next write. No wipe.
