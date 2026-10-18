# Tasks

## 1. Platform module + DI wiring

- [x] 1.1 Add `src/editor/session/browserProjectSessionPlatform.ts` with browser picker (AbortError→null), `requestReadwritePermission`, default timers/session/storage helpers, and `createBrowserProjectSessionDeps()`. Verify: module typechecks; exports usable without React.
- [x] 1.2 Add `src/editor/session/browserProjectSessionPlatform.test.ts` covering AbortError→null picker, permission granted/denied/unavailable, and `createBrowserProjectSessionDeps` wiring. Verify: `pnpm exec vitest run src/editor/session/browserProjectSessionPlatform.test.ts` passes.
- [x] 1.3 Extend `ProjectSessionDeps` with `requestReadwritePermission` + `timers`; route picker/permission/timer call sites in `projectSession.ts` through deps; install browser defaults via the platform factory; call `configureProjectSession(createBrowserProjectSessionDeps())` from `main.tsx` before render. Verify: existing `projectSession` / HomeScreen unit tests still pass; no `showDirectoryPicker` / bare `setTimeout` left on those paths.

## 2. Done-when session tests

- [x] 2.1 Cover picker cancel, permission prompt/denied, and re-grant through production `createLibrary` / `regrantLibrary` using `createFakeDirectoryPicker`, `createFakeBrowserDirectory`, and `createMemorySessionState` (injected deps; no fresh-module global stub required). Verify: named cases in `projectSession.test.ts` pass under Vitest with no browser.
- [x] 2.2 Cover lock paths and autosave debounce via injected `timers` + fake timers / `memorySessionState`. Verify: existing lock + autosave cases still pass; at least one case schedules via injected timers.
- [x] 2.3 Tick scope boxes in `docs/roadmap/M2.1/project-session-deps.md` only when delivered. Verify: item checkboxes match shipped work.

## 3. Mutation / coverage

- [x] 3.1 Run `pnpm stryker:diff` and `pnpm test:coverage`; kill NoCoverage / survivors on `browserProjectSessionPlatform.ts`; add public-API tests for specified-behavior survivors; list equivalent leftovers under this task. Do not edit mutation exclusions / quality gates. Verify: platform module ≥85 mutation, 0 NoCoverage; `projectSession.ts` remains temporary-excluded; aim for ≥85% patch on `projectSession.ts` (Codecov proves Done-when).
  - stryker:diff: `browserProjectSessionPlatform.ts` 100% (49 killed, 0 survived, 0 NoCoverage); `projectSession.ts` still excluded (`!src/editor/projectSession.ts`)
  - survivors/leftovers: none
  - coverage: platform module 100% lines; projectSession unit lines ~79% whole-file — patch ≥85% is Codecov on the PR head (DI call sites exercised by Vitest FSA/lock/timer suites)

## Verification

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test — via `pnpm verify:fast:quiet`
- [x] pnpm test:e2e (or pnpm verify) — N/A for this prep (no e2e touch); `pnpm test:e2e:changed:quiet` once if any e2e file is in the diff
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected — N/A
- [x] UI in scope: browser smoke evidenced; skill `ui-review` pass — N/A ([prep] DI only)
- [x] Docs/rules sync: roadmap item scope ticks; no AGENTS/README drift
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A (no dep change); Security Review still required for FSA surface
- [x] Launch openspec-design-reviewer was pass before apply (evidenced) — agent `ed5633b4-d827-4782-9203-61abdac31eaa` pass
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive — pass (`e69ecdf7`); medium inject-permission fixed; Codecov patch deferred to PR head
- [x] Manual check (after implementation review pass, before archive): [prep] non-UI — see `## Manual test scenarios`
- [x] Security Review: Cursor Security Review subagent before archive (FSA security surface) — PASS (`bce99076`); no medium+

## Manual test scenarios

1. Platform contract: `pnpm exec vitest run src/editor/session/browserProjectSessionPlatform.test.ts` → 16 passed (AbortError→null, permission granted/denied/unavailable, sessionStorage omit, IDB memory/browser branch, storage from memory + browser handle)
2. Injected permission denial: `pnpm exec vitest run src/editor/projectSession.test.ts -t "regrant uses the injected"` → pass (`requestReadwritePermission` called with peeked handle; homeError denied)
3. FSA Done-when via shared fakes: `pnpm exec vitest run src/editor/projectSession.test.ts -t "Dont Allow|regrant from home|browserPickDirectory AbortError|permissions and locks"` → pass
4. Autosave via injected timers: `pnpm exec vitest run src/editor/projectSession.test.ts -t "autosave"` → pass
5. Timers DI seam (manual timers, not globalThis): `pnpm exec vitest run src/editor/projectSession.test.ts -t "schedules autosave only through the injected timers"` → pass (arm/clear/debounce via injected setTimeout; fails if call sites use bare globals)
6. `pnpm verify:fast:quiet` → exit 0 (103 files / 1185 tests)
7. `pnpm stryker:diff` → `browserProjectSessionPlatform.ts` 100% (0 NoCoverage); `projectSession.ts` remains temporary-excluded
8. Browser / `pnpm dev` — N/A ([prep] DI; no UI change)
