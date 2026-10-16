# Design

## Context

See proposal.md. SessionState stores one handle key; `projectSession` uses `DEFAULT_LIBRARY_ID` and `sessionStorage` for active ids; cold start mounts editor + `tryRestore`. **Assumption:** roadmap Perf — static list chrome; existing save/gesture gates stay green.

## Goals / Non-Goals

**Goals:** multi-library recents in SessionState; home surface; open book from home; same-tab reload restore when an active book id is present.

**Non-Goals:** book titles in LibraryStorage; missing-assets; on-disk layout changes.

## Decisions

1. **Home vs restore gate** — Editor restore runs **only** when `sessionStorage` has an **active book id** (and a library id). Otherwise show home — even if `libraryId` or durable `_active` remain. Adjust `tryRestore` / surface selection: without book id, do not bind into the editor; load recents for home instead.

2. **Recents API** — `listRecentLibraries()` → `{ id, label }[]`. `rememberLibraryHandle(id, handle, label?)` upserts + move-to-front (label from `handle.name` when FSA). `clearLibraryHandle` drops the recent. `setActiveIds` / `getActiveIds` for durable last-active. Lists never return handles.

3. **IDB** — Version bump: keep `library-handles`; keys `_recents` (ordered `{id,label}[]`) and `_active`. Migrate: seed `{ id: 'library', label: 'Library' }` if a `library` handle exists.

4. **Library ids** — New picker create/open → `crypto.randomUUID()`. If a recent handle `isSameEntry`-matches the picked folder, reuse that id; else new. Keep legacy `library` working.

5. **Home UI** — `HomeScreen` under `src/editor/` (one new UI region). `projectSession`: `listRecents()`, `selectRecentLibrary(id)` (returns books), `openBookFromHome(libraryId, bookId)`, plus create/open. Wire `App`/`EditorShell` from a narrow subscription. Test ids: `home-screen`, `home-recents`, `home-books`; scrollport `data-testid="home-scroll"` / `data-scrollport="home"`.

6. **Permission on select and open** — Both `selectRecentLibrary` and `openBookFromHome` recall the handle first. On `permission-required`, set existing `accessPhase` and show re-grant — never a silent empty book list. On grant, bind storage, list or `loadBook` + activate/lock (reuse activate).

7. **Create/open from home** — Existing bind/adopt/load paths; enter editor on success; update recents.

## Touch-set

`src/project/session/{types,idb,browserSessionState,memorySessionState}.ts` + contract tests; `src/editor/projectSession.ts` (+tests); `src/editor/HomeScreen.tsx` (+CSS); `App.tsx` / `EditorShell.tsx`; `e2e/recents-home.spec.ts`; reuse `clearProjectSession`, OPFS/`testLibrary`, `assertDocumentFitsViewport` / `assertNamedScrollport`.

## Composition

Adapters stay React-free in `src/project`. Orchestration in `projectSession`. Home presentational; shell stays thin.

## Tests

Public: SessionState recents/active + contract suite; surface selection; `openBookFromHome` / select-recent permission.

- E2E empty: no recents → empty home + New/Open; viewport contained.
- E2E happy: seam open library+book → clear sessionStorage → reload → home lists → click book → editor.
- E2E interact: select recent → books; overflow → `assertNamedScrollport('home')`; after open, filmstrip/pasteboard.
- Same-tab reload with active book id still restores (open-save).
- `ui-review` before push.

## Security

Handles only on SessionState/IDB; never in `book.json` or list payloads. Picker/re-grant on user gesture only. No new CSP/deps.

## Risks / Trade-offs

- [Orphan `library` handle] → migrate seeds recents.
- [isSameEntry missing] → new id (duplicate recent OK).

## Migration Plan

Additive IDB bump + seed. Rollback = revert PR.
