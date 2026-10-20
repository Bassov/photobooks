# Tasks

## Implementation

- [x] 1. Reused+knownHash: pass existing `contentHash` into `seedAndHashEntry`; when known, skip `hashContent` / `patchAssetRecord` / cache puts (seed only) — tests in `seedLibraryImport.test.ts` / identity
- [x] 2. E2E: await `Saved` before `clearThumbsAndDerivedCacheForTests` in library re-import LoAF window; budgets unchanged
- [x] 3. Isolate burn-in spawn CLI via `initTmpRepo` + assert exact `e2e/burn-in-smoke.spec.ts`
- [x] 4. `validateCodecovYml`: `AbortSignal.timeout(2500)`; treat Abort/Timeout as network; unit coverage without live API; verify weakening inventory fixture path
- [x] 5. `pnpm check` / targeted vitest / `stryker:diff` (**85.96%**, 0 NoCoverage); changed e2e once; implementation-reviewer; Manual N/A (prep; LoAF locked by existing filmstrip e2e)

Overflow (scheduled): `reimport-loaf-store-thumb` — bookStore no-op meta/patch + thumb put dedupe.

## Manual test scenarios

N/A — prep flake hardening; no new UI surface. Re-import LoAF remains gated by `e2e/filmstrip.spec.ts` library re-import async scenario.
