# Design

## Context

See proposal.md. Book lock acquire/release, `locked-elsewhere` chrome, and permission re-grant still live inline in `projectSession.ts` (temporary Stryker exclude). Platform deps and FSA fakes already exist (`browserProjectSessionPlatform`, `browserDirectory.test-helpers`). Autosave is already extracted — do not rework it. No spec deltas (`skip_specs: true`).

## Goals / Non-Goals

**Goals:** Extract a focused, mutable book-lock controller; session delegates lock hold, locked-elsewhere enter/clear, and re-grant orchestration; controller unit tests hit 85+ mutation / 0 NoCoverage and patch ≥85; integration + `permissions-locks` e2e unchanged.

**Non-Goals:** Moving library open/adopt/home orchestration beyond what re-grant already calls; rewriting or relocating `projectSession.test.ts`; changing Stryker exclusions/gates; product behaviour or Web Lock semantics; autosave controller edits.

## Decisions

1. **Factory + instance** — `createBookLockController(deps)` returns an object owning `heldBookLock`, `blockedBookId`, external test lock, and pending re-grant library/book ids. Session keeps one module-level instance (reset/reconfigured from `configureProjectSession` / reset). Alternative: keep state on session and move only free functions — rejected; factory matches `autosaveController` and is unit-testable without the full session.

2. **Deps / host callbacks** — Inject `acquireBookLock`, platform `pickDirectory` + `requestReadwritePermission`, and host callbacks for every call site of the five moved functions (autosave cancel/reset/phase + bump `saveEpoch`, clear locked placeholder, persist ids, status/homeError/emit, bind/remember/createStorage, `runSave`, activate-after-grant, `withActionBusy`, same-entry check). No React; do not rewrite autosave.

3. **Preserve every guard** — Move `releaseHeldBookLock`, `takeBookLock`, `clearDocumentWhileLocked`, `regrantWithHandle`, and `regrantLibrary` **verbatim** (same early returns and order; same `locked-elsewhere` / requestPermission-then-picker / `isSameEntry` / mid-session vs home branches). No “simplify” (autosave review dropped a guard).

4. **Owned vs session** — Controller owns held/external lock, `blockedBookId`, pending re-grant ids, and the five moved flows. Session keeps `accessPhase` / `bookId` / `storage` / `libraryId` via host setters. Beyond take/release/regrant, session **must** call controller setters/seams wherever those fields are set/cleared today: `setPendingRegrant` (home select/open permission-required), `clearBlockedAndPending` (reset / successful open-adopt / leave locked chrome), and `holdExternalBookLock` (test seam). Public exports stay thin delegates.

5. **Tests** — Public controller API: second holder → `locked-elsewhere`; release frees re-acquire; re-grant branches via `createFakeBrowserDirectory` + injected permission/picker. Integration stays in `projectSession.test.ts`. E2e `permissions-locks` untouched.

## Touch-set

| Path                                            | Reason                                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/editor/session/bookLockController.ts`      | new; mutated                                                                                       |
| `src/editor/session/bookLockController.test.ts` | new focused tests                                                                                  |
| `src/editor/projectSession.ts`                  | delegation only; stays temporary exclude — do not edit `stryker.config.json` / `stryker.mutate.md` |
| `docs/roadmap/M2.1/book-lock-controller.md`     | scope ticks                                                                                        |
| `openspec/changes/book-lock-controller/`        | change artifacts                                                                                   |

No quality-gate config edits. No e2e/Playwright/CI/package.json. Do not move `projectSession.test.ts`. Do not edit `autosaveController.ts`.

## Composition

`configureProjectSession` → (re)create controller with deps + host callbacks. Session call sites: `take` / `release` / `regrant` / `regrantWithHandle`, plus `setPendingRegrant` / `clearBlockedAndPending` / `holdExternalBookLock` / getters wherever those fields were touched before. Pure TS; production never imports `*.test-helpers.ts`.

## Tests

**Controller:** acquire; concurrent → `locked-elsewhere` + blocked id; release then re-acquire; release host cancel/epoch guards; re-grant granted/denied/picker+sameEntry/mid-session. Injected lock fake + `createFakeBrowserDirectory` + permission/picker only.

**Session:** existing `projectSession.test.ts` permissions/locks; e2e untouched. Local: one green vitest (controller + session) + `pnpm check`.

## Security

No new FSA surface. Re-grant: `requestPermission` first, picker only on non-granted, `isSameEntry` before bind. No auto-grant / skip same-entry. Fakes Vitest-only.

## Risks / Trade-offs

- [Dropped early return / reorder] → Verbatim move + guard tests; integration/e2e unchanged.
- [Split-brain on blocked/pending] → Explicit setters/seams for every former direct write.
- [Mutation survivors] → Branchy logic in controller; list true equivalents in tasks.md.

## Migration Plan

Additive extract + delegation. Rollback = revert PR.
