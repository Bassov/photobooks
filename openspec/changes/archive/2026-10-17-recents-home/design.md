# Design

## Goals / Non-Goals

**Goals:** Fix merge blockers N1–N4, N3, N7, N8 with minimal diffs; align specs/tasks with reality.

**Non-Goals:** Quality polish (`recents-home-quality`); book titles; new features.

## Decisions

1. **Leave sequence (Home / New-after-pick / Open-switch)** — Ordered: (a) if `savePhase === 'error'` or flush fails → stay editor + readable message; (b) flush dirty pending save and await in-flight save; (c) release book lock; (d) reset book store to a fresh empty book + clear sessionMeta/asset sources; (e) clear storage/ids/surface as appropriate.

2. **Adopt gates** — After bind: (1) never adopt a document that belonged to a different prior `libraryId`; (2) `mode:'open'` when editor has no content → load stored book (prefer filled); (3) session-only content with no prior library-backed book → adopt; (4) New library clean start after Home/release → empty book only (no copy of previous `book.json`).

3. **New library pick-first** — `pickDirectory` before any release. Cancel/null → return; book+lock untouched.

4. **Remember failure = rollback** — After activate, if remember fails: release lock, clear storage/ids, reset document, `homeError`, home surface. Same for `openBookFromHome`.

5. **Restore busy** — `tryRestore` under `withActionBusy`; EditorShell disables New/Open/Home/Grant while `restorePending || actionBusy`.

6. **Locked home reset** — On home after locked-elsewhere from home open, clear `accessPhase` / blocked id / placeholder.

7. **ARIA** — Recent `<ul>` plain list; selected button `aria-current` only (no listbox/aria-selected).

8. **Spec soften** — Busy focus, hard IDB no-throw, absolute single-txn → `recents-home-quality`. Honest Stryker: survivors in `browserSessionState.ts`.

## Touch-set / tests

- Code: `projectSession.ts`, `EditorShell.tsx`, `HomeScreen.tsx`
- Unit: `leaveEditorForHome`, `createLibrary`, `openLibrary`/`bindLibrary`, `tryRestore`, remember-failure — extend `projectSession.test.ts` with two memory storages + fake handles; place photos via `dispatchBookOp` / existing gallery fixtures
- Component: minimal `HomeScreen.test.tsx` (ARIA + loading)
- E2e: extend `e2e/recents-home.spec.ts` — Home→Open other library; edit→Home→reopen; baseline empty/happy/`home-scroll` stay green
- Before push: short `ui-review` on empty home + Home→Open happy (full a11y suite stays in quality)

## Security

Opaque handles; rollback on remember failure.

## Risks

Adopt heuristics — cover with placed-photo cross-library fixtures.
