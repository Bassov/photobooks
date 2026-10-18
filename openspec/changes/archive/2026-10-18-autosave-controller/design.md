# Design

## Context

See proposal.md. Autosave debounce, gesture gate, `savePhase`, and `awaitPendingHashes` before persist still live inline in `projectSession.ts` (temporary Stryker exclude). Platform timers/deps and FSA fakes already exist (`browserProjectSessionPlatform`, `browserDirectory.test-helpers`). No spec deltas (`skip_specs: true`).

## Goals / Non-Goals

**Goals:** Extract a focused, mutable autosave controller; session delegates scheduling + phase + pending-hash wait; controller unit tests hit 85+ mutation / 0 NoCoverage and patch ≥85; integration + autosave e2e unchanged.

**Non-Goals:** Moving lock/library/open orchestration; rewriting or relocating `projectSession.test.ts`; changing Stryker exclusions/gates; product behaviour or debounce timing changes.

## Decisions

1. **Factory + instance** — `createAutosaveController(deps)` returns a small object owning timer, `debounceMs`, and `savePhase`. Session keeps one module-level instance (recreated/reconfigured from `configureProjectSession` / reset). Alternative: module singleton mirroring session — rejected; factory is easier to unit-test without the full session.

2. **Deps** — Inject `timers` (`ProjectSessionTimers`), `isGestureActive`, `awaitPendingHashes`, and debounce ms. Controller does **not** import storage or FSA.

3. **Single hash-wait seam** — Move the only `awaitPendingHashes()` out of `persistBookSnapshot` into `controller.waitForPendingHashes()` (no nested async persist wrapper — avoids an extra microtask before `finally`/`emit`). Session persist body stays inline after that await and MUST NOT await hashes again. Tests assert the waiter runs before callers continue.

4. **Phase API (session never writes phase)** — Controller exposes: `getSavePhase`, `arm` / `cancel`, `onGestureIdle`, `beginSaving` / `ensureSaving`, `completeSavingIfSaving` (finally only), `settleAfterPersist` (unconditional post-persist idle|pending), `failSaving`, `reset` / `markPendingFromError`. Session call sites use these only; no direct `savePhase =`.

5. **Owned vs session** — Controller: timer, debounce, gesture gate, phases, hash-wait-then-persist. Session: dirty/editGeneration/saveEpoch, storage I/O, locks, adopt, snapshot `emit` (reads phase via `getSavePhase`).

6. **Tests** — Public `createAutosaveController` API: debounce fire, cancel/re-arm, gesture gate, phase helpers, hash-before-persist order (deferred hash waiter). Unit tests use only injected `timers` + stub `awaitPendingHashes` / `isGestureActive` (no new helpers). `browserDirectory.test-helpers` stays integration-only in `projectSession.test.ts`. E2e `autosave` untouched.

## Touch-set

- `src/editor/session/autosaveController.ts` (new; mutated)
- `src/editor/session/autosaveController.test.ts` (new)
- `src/editor/projectSession.ts` (delegation only; stays temporary exclude — do not edit `stryker.config.json` / `stryker.mutate.md`)
- `docs/roadmap/M2.1/autosave-controller.md` (scope ticks)
- `openspec/changes/autosave-controller/`

No quality-gate config edits. No e2e/Playwright/CI/package.json. Do not move `projectSession.test.ts`.

## Composition

`configureProjectSession` → (re)create/update controller with injected timers + debounce + hash waiter → session `arm`/`cancel`/`onGestureIdle`/`beginSaving`/`ensureSaving`/`completeSavingIfSaving`/`settleAfterPersist`/`failSaving`/`waitForPendingHashes` only. Controller is pure TS (no React). Production never imports `*.test-helpers.ts`.

## Tests

**Controller (direct, injected fakes only):** arm → fire after debounce; no fire while gesture active then fire after end+re-arm; cancel clears timer; phase API; `waitForPendingHashes` (deferred hash job). No FSA helpers in this suite.

**Session (integration, existing):** public autosave cases in `projectSession.test.ts` stay; e2e `autosave` untouched. Local: one green vitest on controller + session suites + `pnpm check`.

## Security

No new FSA/picker/permission surface. Hash-wait remains before `saveBook`; injection must not skip wait or auto-grant. Test fakes stay Vitest-only.

## Risks / Trade-offs

- [Phase dual-source drift] → Single controller owns `savePhase`; session only reads/delegates.
- [Extract changes ordering] → Controller tests lock hash-before-persist and gesture gate; integration/e2e unchanged.
- [Mutation survivors on thin wrappers] → Prefer branchy logic in controller; list true equivalents in tasks.md.

## Migration Plan

Additive extract + delegation. Rollback = revert PR.
