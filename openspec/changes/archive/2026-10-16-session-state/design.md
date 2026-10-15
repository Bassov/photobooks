# Design

## Context

See proposal.md. `src/project` has `LibraryStorage` (+ FSA) with simulated locks. Architecture (`docs/future-architecture.md`): `SessionState` owns disposable handles, recents, prefs, Web Locks. This change: handles + locks only. No UI; security surface is FSA handles in IndexedDB + Web Locks.

## Goals / Non-Goals

**Goals:** Domain `SessionState`, memory + browser adapters, shared contract suite, real Web Locks per book, IndexedDB handle persistence.

**Non-Goals:** Recents/prefs APIs; open/save chrome; wiring locks into `LibraryStorage` call sites; permission re-grant UI.

## Decisions

1. **Reuse typed results** — Same `StorageResult` / `StorageFailureCode` from `src/project/types.ts` (`not-found`, `locked-elsewhere`, `permission-required`). No parallel result union. **Assumption:** unused codes stay on the shared type for one project vocabulary.

2. **API surface** (domain, no IDB/lock-name leakage):
   - `rememberLibraryHandle(libraryId, handle)` / `recallLibraryHandle(libraryId)` / `clearLibraryHandle(libraryId)` (clear of missing → `not-found`)
   - `acquireBookLock(bookId)` → success with `{ release(): Promise<void> }` or `locked-elsewhere`
   - Handle type: opaque `SessionDirectoryHandle` = browser `FileSystemDirectoryHandle` at the boundary; memory adapter accepts any object identity for round-trip tests (injectable fake). Domain MUST NOT put handles on `LibraryStorage`.

3. **Modules** — `src/project/session/`:
   - `types.ts` — `SessionState`, lock handle type
   - `memorySessionState.ts` — Map + in-process lock table
   - `browserSessionState.ts` — IndexedDB + `navigator.locks`
   - `idb.ts` — thin get/set/del (no Dexie; tiny helper or `idb-keyval` if one dep stays smaller than custom — prefer **zero new deps** with ~30-line IDB helper unless review prefers `idb-keyval`)
   - `sessionState.contract.test-helpers.ts` — shared suite
   - Tests + export from `src/project/index.ts`

4. **IndexedDB** — DB name `photobooks-session`, store `library-handles`, key = `libraryId`, value = `FileSystemDirectoryHandle`. Missing key → `not-found`.

5. **Web Locks** — Name `photobooks:book:${bookId}`; `navigator.locks.request(name, { ifAvailable: true }, callback)`. If lock is `null` → `locked-elsewhere`. Hold until `release()` resolves the callback’s waiter (AbortController or deferred promise). Memory adapter mirrors ifAvailable semantics.

6. **Permission** — On recall, if `handle.queryPermission` exists, call it with `{ mode: 'readwrite' }`; any state other than `granted` → `permission-required` (do not call `requestPermission` here — UX later). Memory harness `setPermissionRequired(true)` for the contract case.

7. **Browser harness in Node** — Inject `idb` + `locks` ports into `createBrowserSessionState({ idb, locks })` so Vitest uses fakes; production wiring uses real IDB + `navigator.locks`.

8. **Mutation** — Keep new production files in default mutate scope; exclude only pointless shells in `stryker.mutate.md` if any.

## Touch-set

`src/project/session/*`, `src/project/index.ts`, contract helpers/tests, optional `stryker.mutate.md`, AGENTS module-map line for session-state, archive sync of new spec, nested roadmap tick.

## Composition

`src/project/session` → no React; may use FSA handle types from ambient DOM libs. Callers use `createMemorySessionState` / `createBrowserSessionState` from `src/project`. Locks stay on `SessionState`; FSA `LibraryStorage` keeps its simulated lock until a later wiring change.

## Tests

Public API: factories + contract suite. Extra memory cases for release/re-acquire. Browser factory with fake IDB/locks. No e2e / UI / LHCI. Reuse Vitest patterns from `libraryStorage.contract.test-helpers.ts`.

## Security

Handles only on `SessionState` (not book JSON / workers). IDB stores handles locally; no network. Lock names are app-prefixed strings, not user paths. No CSP/COOP/COEP changes. Do not `postMessage` handles into workers.

## Risks / Trade-offs

- [IDB/locks fakes ≠ Chromium] → inject ports; real-browser smoke in later open/save.
- [Locks not wired to LibraryStorage yet] → intentional; `permissions-locks-ux` / open-save own UX wiring.
- [Zero-dep IDB vs idb-keyval] → prefer zero dep; switch only if helper grows.

## Migration Plan

Additive. Rollback = revert PR.
