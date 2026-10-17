# mutation-reinclude-small

Tag: prep
Milestone: M2.1
Title: mutate the small files that already have tests (issue #72 B)

## Scope

- [ ] Remove the `temporary` entries for `src/editor/previewAspect.ts`, `src/editor/upgradeSessionAssets.ts`, `src/photo/photo.worker.ts` and `src/assets/hash.worker.ts` (named in the registry with `until: mutation-reinclude-small`)
- [ ] Shared `workerHarness.test-helpers.ts` (stub `postMessage`, dispatch `MessageEvent`). Worker tests for all three worker shells, including the `hash.worker.ts` error mapping
- [ ] Kill survivors through public APIs until each file reaches 85 (only the `processAsset` boundary is mocked)
- **Done when:** these files are mutated on both runs with no NoCoverage, and each scores at least 85.
- **Size:** ~600 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #72 B
