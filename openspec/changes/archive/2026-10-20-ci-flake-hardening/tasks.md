# Tasks

## Implementation

- [x] 1. Reused+knownHash: resolve existing `contentHash` inside `seedAndHashEntry`; when known, skip `hashContent` / `patchAssetRecord` / cache puts (seed only) — tests in `seedLibraryImport.test.ts` / identity
- [x] 2. E2E: await `Saved` before `clearThumbsAndDerivedCacheForTests` in library re-import LoAF window; budgets unchanged
- [x] 3. Isolate burn-in spawn CLI via `initTmpRepo` + assert exact `e2e/burn-in-smoke.spec.ts`
- [x] 4. Verify weakening inventory fixture path (`testdata/test-weakening-inventory`); no live-repo walk
- [x] 5. Patch-coverage: ignore non-instrumented lines (imports/comments/braces) when LCOV has the file
- [x] 6. `pnpm check` / targeted vitest / `stryker:diff`; changed e2e once; Manual N/A (prep; LoAF locked by existing filmstrip e2e)

Overflow (scheduled): `reimport-loaf-store-thumb` — bookStore no-op meta/patch + thumb put dedupe; `codecov-validate-timeout` — AbortSignal.timeout for Codecov YAML validate (deferred: Istanbul/patch-coverage on fetch helpers).

## Manual test scenarios

N/A — prep flake hardening; no new UI surface. Re-import LoAF remains gated by `e2e/filmstrip.spec.ts` library re-import async scenario.
