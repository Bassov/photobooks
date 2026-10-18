# Design

## Context

See proposal.md. Library create/open, adopt, switch-with-book-open, and restore-from-recents still live inline in `projectSession.ts` (temporary Stryker exclude). `autosaveController` and `bookLockController` already exist — do not rework them. Platform deps and FSA fakes already exist. No spec deltas (`skip_specs: true`).

## Goals / Non-Goals

**Goals:** Extract a focused, mutable library-activation module; session thin-delegates; module unit tests hit mutation/coverage Done-when with named PR #71 data-loss cases; integration + library/recents/permissions e2e unchanged.

**Non-Goals:** Moving leave-home / createBook / save beyond what activation already calls; relocating `projectSession.test.ts`; Stryker/gate edits; product behaviour; autosave or book-lock edits.

## Decisions

1. **Factory + host** — `createLibraryActivation(host)` owns the moved flows (same pattern as `bookLockController`). Session keeps one module-level instance; `setHost` after configure/reset. Alternative: free functions with a deps bag — rejected; factory matches prior extracts.

2. **Moved surface (verbatim)** — Always move: `createLibrary`, `openLibrary`, `bindLibrary`, `activateLibraryAfterBind`, `pickAndActivateLibraryBook`, `activateLoadedBook`, `adoptCurrentBookInLibrary`, `releaseOpenBookForNewLibrary`, `bookHasContent`. Same early returns and order (picker cancel → flush → release/bind; open mode never adopts foreign content into an empty library; remember-handle failure rolls back). No “simplify” (autosave extract dropped a guard).

3. **Deferrable under growth rule** — Prefer also moving `selectRecentLibrary`, `openBookFromHome`, `tryRestore`, `clearStaleRestoreState`. If apply exceeds size budget, defer only that subset via `pnpm roadmap add … --after library-activation`.

4. **Host callbacks** — Inject session seams by category (busy/picker/storage/locks/autosave/persist/status/emit/book-store/assets/ids/dirty/restorePending). Full callback inventory lives in apply/tasks — not duplicated here. No React; do not edit autosave/book-lock modules.

5. **Public API** — Session exports stay thin delegates. `attachLibraryForTests` keeps calling `bindLibrary` via the controller.

6. **Tests** — Public controller API via host fakes + `createMemoryLibraryStorage` / `createMemorySessionState` / `createFakeBrowserDirectory` + injected picker/permissions. Named PR #71 cases: switch never writes previous book into the new library; New library keeps unsaved edits / starts clean; picker cancel and permission denied leave state unchanged. Integration stays in `projectSession.test.ts`. E2e untouched.

## Touch-set

| Path                                           | Reason                                                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/editor/session/libraryActivation.ts`      | new; mutated                                                                                       |
| `src/editor/session/libraryActivation.test.ts` | new focused + adversarial tests                                                                    |
| `src/editor/projectSession.ts`                 | delegation only; stays temporary exclude — do not edit `stryker.config.json` / `stryker.mutate.md` |
| `docs/roadmap/M2.1/library-activation.md`      | scope ticks                                                                                        |
| `openspec/changes/library-activation/`         | change artifacts                                                                                   |

No quality-gate / e2e / Playwright / CI / package.json edits. Do not move `projectSession.test.ts`. Do not edit `autosaveController.ts` / `bookLockController.ts`.

## Composition

`configureProjectSession` / reset → (re)create or `setHost` on activation. Session create/open/bind/adopt/(recents-restore) call sites become thin delegates. Pure TS; production never imports `*.test-helpers.ts`.

## Tests

**Module:** create/open; adopt vs open empty-library guard; switch data-loss; picker cancel; permission-denied; flush failure aborts. Injected host + memory storage/session + FSA fakes.

**Session:** existing `projectSession.test.ts`; e2e untouched. Local: one green vitest (module + session) + `pnpm check`.

## Security

No new FSA surface, handles, blob/object URLs, or permission prompts. Picker cancel → `not-found`; permission-required uses the same access phase / pending re-grant via bookLocks host; no auto-grant. Fakes Vitest-only.

## Risks / Trade-offs

- [Dropped early return / reorder] → Verbatim move + adversarial named tests; integration/e2e unchanged.
- [Host split-brain] → Former direct writes go through host setters; session still owns the fields.
- [Size overrun] → Defer recents/restore via growth rule (Decision 3).
- [Mutation survivors] → Branchy logic in module; list true equivalents in tasks.md.

## Migration Plan

Additive extract + delegation. Rollback = revert PR.
