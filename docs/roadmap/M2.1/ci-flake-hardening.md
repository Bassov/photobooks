# ci-flake-hardening

Tag: prep
Milestone: M2.1
Title: Harden CI flakes (re-import LoAF, burn-in spawn, codecov timeout)
Status: done

## Scope

- [x] Product: reused+knownHash seed-only path in `importPhotos` / `seedLibraryImport` (skip re-hash / patch / cache puts when contentHash already known)
- [x] E2E: await `Saved` before `clearThumbsAndDerivedCacheForTests` in library re-import LoAF window (`e2e/filmstrip.spec.ts`); budgets unchanged
- [x] Unit: isolate `e2e-burn-in-targets` spawn CLI via `initTmpRepo`; `validateCodecovYml` fetch `AbortSignal.timeout` + AbortError as network; verify `check-test-weakening` inventory still uses `testdata/test-weakening-inventory`
- Out of scope (follow-up `reimport-loaf-store-thumb`): `bookStore` identical meta/patch no-ops; `thumbCache` put dedupe (whole-file mutate of those modules failed the 85 bar in this change)
- **Done when:** (1) re-import scroll LoAF assert stays at 0 entries with unchanged `PERF_BUDGETS`; (2) burn-in spawn test asserts a deterministic path from a tmp repo (no live `origin/main` empty-diff flake); (3) hung Codecov validate falls back within ~2.5s without Vitest 5s timeout; (4) weakening inventory fixture path confirmed; (5) `pnpm check` green, patch ≥85, stryker:diff ≥85 / 0 NoCoverage
- **Size:** ~600–900 changed lines
- **Source:** Codecov Analytics flakes + CI `39250896481` / `39291953389` / PR #136/#137

## Done note

seed-only knownHash re-import; Saved wait; burn-in tmp; codecov timeout; store/thumb follow-up reimport-loaf-store-thumb
