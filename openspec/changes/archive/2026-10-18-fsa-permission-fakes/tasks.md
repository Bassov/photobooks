# Tasks

## 1. Shared FSA permission fake

- [x] 1.1 Extend `src/project/fsa/browserDirectory.test-helpers.ts` with scriptable `queryPermission` / `requestPermission` (sticky + per-call queue; `granted` request updates sticky) and `createFakeDirectoryPicker({ outcomes })` that yields handles or rejects `AbortError`. Verify: existing `createFakeBrowserDirectory()` callers still typecheck; default permission is `granted`.
- [x] 1.2 Add `src/project/fsa/browserDirectory.test-helpers.test.ts` contract cases for sticky/queued query+request, picker cancel `AbortError`, and re-grant sticky update. Verify: `pnpm exec vitest run src/project/fsa/browserDirectory.test-helpers.test.ts` passes.

## 2. Done-when via production consumers of the shared fake

- [x] 2.1 Replace local permission stubs in `browserSessionState.test.ts` with `createFakeBrowserDirectory`; contract harness + describe reuse it. Verify: no local `createFakeDirectoryHandle`.
- [x] 2.2 Deny / prompt / re-grant through production `hasReadwritePermission` → `recallLibraryHandle` (shared fake). Verify: Vitest cases in `browserSessionState.test.ts`.
- [x] 2.3 Prompt-then-deny + re-grant through production `requestPermissionOnHandle` → `regrantLibrary` in `projectSession.test.ts` (test file only; shared fake). Verify: Dont Allow + from-home regrant cases.
- [x] 2.4 Cancel through production `defaultPickDirectory` (AbortError → null) via fresh-module `createLibrary` + `showDirectoryPicker` fake; restore/delete picker after. Verify: not-found, library not bound.
- [x] 2.5 Tick matching scope boxes in `docs/roadmap/M2.1/fsa-permission-fakes.md`. Verify: item scope checkboxes match shipped work.

## 3. Mutation / coverage on touched production (if any)

- [x] 3.1 Run `pnpm stryker:diff` and `pnpm test:coverage` for files this change touched that are in production mutate/coverage scope; add public-API tests for survived/NoCoverage that encode specified behavior; list equivalent leftovers under this task. Verify: no new NoCoverage on in-scope production; helpers stay excluded as `*.test-helpers.ts`.
  - stryker:diff: skipped (no mutable `src` production files vs origin/main; only `*.test-helpers.ts` + tests)
  - coverage: N/A for mutate/coverage score on production touch-set (helpers + tests only); helpers excluded by `*.test-helpers.ts`

## Verification

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test — via `pnpm verify:fast:quiet`
- [x] pnpm test:e2e (or pnpm verify) — N/A for this prep (no e2e touch); `pnpm verify:fast:quiet` + targeted vitest
- [x] pnpm stryker:diff — skipped, no mutable production diff
- [x] pnpm test:lhci when UI or bundle size is affected — N/A
- [x] UI in scope: browser smoke evidenced; skill `ui-review` pass — N/A (test helpers only)
- [x] Docs/rules sync: roadmap item scope ticks; no AGENTS/README drift
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A (no dep change); Security Review still required for FSA surface
- [x] Launch openspec-design-reviewer was pass before apply (evidenced) — agent `7687a907-73ac-4969-9667-c64c4fb09fad` pass
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive — pass (`18404af3`); lows addressed (cancel bind assert; coverage N/A wording)
- [x] Manual check (after implementation review pass, before archive): [prep] non-UI — see `## Manual test scenarios`
- [x] Security Review: Cursor Security Review subagent before archive (FSA security surface — test helpers) — PASS (`359174d6`); no medium+

## Manual test scenarios

1. Fake contract: `pnpm exec vitest run src/project/fsa/browserDirectory.test-helpers.test.ts` → pass (sticky/queue/re-grant/picker AbortError)
2. Deny / prompt / re-grant via production `hasReadwritePermission` + `recallLibraryHandle`: `pnpm exec vitest run src/project/session/browserSessionState.test.ts -t "Done-when"` → pass
3. Prompt-then-deny / re-grant via production `requestPermissionOnHandle` + `regrantLibrary`: `pnpm exec vitest run src/editor/projectSession.test.ts -t "regrant Dont Allow|regrant from home"` → pass
4. Cancel via production `defaultPickDirectory` (AbortError→null) + `createLibrary`: `pnpm exec vitest run src/editor/projectSession.test.ts -t "defaultPickDirectory maps AbortError"` → pass (not-found, libraryOpen false)
5. `pnpm verify:fast:quiet` → exit 0
6. Browser / `pnpm dev` — N/A ([prep] test helpers; no UI)
