# Design

## Context

See proposal.md. `configureProjectSession` already injects `session`, `createStorage`, `pickDirectory`, `storageKey`, `nowId`, `autosaveDebounceMs`. Browser picker (`defaultPickDirectory` → `showDirectoryPicker`), handle `requestPermission`, and autosave `setTimeout`/`clearTimeout` still use globals inside `projectSession.ts`. Shared fakes live in `src/project/fsa/browserDirectory.test-helpers.ts` (PR #96). No spec deltas (`skip_specs: true`).

## Goals / Non-Goals

**Goals:** Complete platform DI for storage factory, sessionState, picker, permissions, and clock/timers; wire browser defaults at the composition root; Vitest covers picker cancel, permission prompt/denied, and re-grant through production paths using the shared fakes + `memorySessionState` + fake timers; new platform-default module mutated at 85 / 0 NoCoverage; `projectSession.ts` stays temporary-excluded.

**Non-Goals:** Moving autosave / lock / library orchestration (later items); changing exclusions or gate configs; Pasteboard / agent / CI / deps; product behavior changes.

## Decisions

1. **Deps surface** — Keep existing `session` / `createStorage` / `pickDirectory` / `storageKey` / `nowId` / `autosaveDebounceMs`. Add `requestReadwritePermission(handle)` (permissions) and `timers: { setTimeout, clearTimeout }` (clock/timers). Orchestration stays in `projectSession.ts`; only platform call sites switch to deps.

2. **Extracted module** — New `src/editor/session/browserProjectSessionPlatform.ts` exports browser implementations (`pickDirectory` via `showDirectoryPicker` + AbortError→null, `requestReadwritePermission` on handle, default timers, `createDefaultSession`, `defaultStorageFromHandle`) and `createBrowserProjectSessionDeps()`. Mutated from this PR. Alternative considered: leave defaults inline — rejected (item requires a new mutated module and composition-root wiring).

3. **Composition root** — `main.tsx` calls `configureProjectSession(createBrowserProjectSessionDeps())` before React render. Module load still installs the same browser defaults so tests and accidental early imports stay coherent; root call makes the wiring explicit.

4. **No silent global bypass** — After configure, picker / permission / timer paths MUST use the injected deps only (no parallel `globalThis` reads in those call sites). Tests inject fakes or the browser platform helpers with scripted handles/picker outcomes.

5. **Tests** — Public API: `configureProjectSession`, `createLibrary` / `openLibrary` / `regrantLibrary`, lock acquire paths, autosave debounce via fake timers. Reuse `createFakeBrowserDirectory`, `createFakeDirectoryPicker`, `createMemorySessionState`, `createMemoryLibraryStorage`. Replace the fresh-module `showDirectoryPicker` cancel case with injected `pickDirectory` from `createFakeDirectoryPicker` (or browser platform + fake). Cover prompt→denied and prompt→granted re-grant through real `requestReadwritePermission` + fake handles. Fake timers via injected `timers` + `vi.useFakeTimers()`.

## Touch-set

- `src/editor/session/browserProjectSessionPlatform.ts` (new; mutated)
- `src/editor/session/browserProjectSessionPlatform.test.ts` (new)
- `src/editor/projectSession.ts` (DI wiring only; stays temporary exclude — do not edit `stryker.config.json` / `stryker.mutate.md` / quality exclusions)
- `src/editor/projectSession.test.ts` (Done-when FSA + timer cases)
- `src/main.tsx` (composition-root configure)
- `docs/roadmap/M2.1/project-session-deps.md` (scope ticks)
- `openspec/changes/project-session-deps/`

No quality-gate config edits. Do not touch Pasteboard, agent scripts, CI, or package.json.

## Composition

`main.tsx` → `configureProjectSession(createBrowserProjectSessionDeps())` → `projectSession` orchestration. Platform module is pure browser adapters (no React). Test helpers remain Vitest-only (`*.test-helpers.ts`); production never imports them.

## Tests

**Platform module (direct):** `pickDirectory` AbortError→null; `requestReadwritePermission` granted / denied / unavailable (no method); `createBrowserProjectSessionDeps` returns wired defaults; timers pass through. Reuse `createFakeBrowserDirectory` / `createFakeDirectoryPicker` where a handle or picker is needed.

**Session (integration):** public `configureProjectSession`, `createLibrary` / `openLibrary` / `regrantLibrary`, lock paths, autosave debounce via fake timers + shared fakes/`memorySessionState` as above. No e2e / UI / LHCI for this [prep]. Local: one green vitest on touched suites + `verify:fast:quiet`; patch ≥85% on `projectSession.ts` is Codecov on the PR head.

## Security

FSA picker and `requestPermission` remain the production trusted path inside the platform module. Injection must not auto-grant or skip `isSameEntry` / denied handling. Test fakes are not production imports.

## Risks / Trade-offs

- [Coverage still short of 85%] → Add public-API cases for uncovered permission/picker/lock/timer branches before archive; do not narrow Done-when.
- [Module default + root configure drift] → Both call the same factory.
- [Timer injection vs Vitest fake timers] → Inject `globalThis` timers by default so `vi.useFakeTimers()` still works when tests omit custom timers.

## Migration Plan

Additive DI + one new module. Rollback = revert PR.
