# Tasks

## 1. Shared FSA permission fake

- [x] 1.1 Extend `src/project/fsa/browserDirectory.test-helpers.ts` with scriptable `queryPermission` / `requestPermission` (sticky + per-call queue; `granted` request updates sticky) and `createFakeDirectoryPicker({ outcomes })` that yields handles or rejects `AbortError`. Verify: existing `createFakeBrowserDirectory()` callers still typecheck; default permission is `granted`.
- [x] 1.2 Add `src/project/fsa/browserDirectory.test-helpers.test.ts` contract cases for sticky/queued query+request, picker cancel `AbortError`, and re-grant sticky update. Verify: `pnpm exec vitest run src/project/fsa/browserDirectory.test-helpers.test.ts` passes.

## 2. FSA library adapter Done-when paths

- [x] 2.1 In `src/project/fsaLibraryStorage.test.ts`, add the design Done-when matrix (deny, prompt-then-deny, cancel, re-grant) bridging fake → `setPermissionRequired` explicitly; reuse the shared fake (no local permission stubs). Verify: those four cases pass via `pnpm exec vitest run src/project/fsaLibraryStorage.test.ts`.
- [x] 2.2 Tick matching scope boxes in `docs/roadmap/M2.1/fsa-permission-fakes.md`. Verify: item scope checkboxes match shipped work.

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

1. `pnpm exec vitest run src/project/fsa/browserDirectory.test-helpers.test.ts` → 7/7 pass (sticky/queue/re-grant/picker AbortError)
2. `pnpm exec vitest run src/project/fsaLibraryStorage.test.ts` → 19/19 pass including Done-when matrix: deny, prompt-then-deny, cancel (no bind), re-grant
3. `pnpm verify:fast:quiet` → exit 0
4. Browser / `pnpm dev` — N/A ([prep] test helpers; no UI)
