# mutation-reinclude-small

Tag: prep
Milestone: M2.1
Title: mutate the small files that already have tests (issue #72 B)

## Scope

- [ ] Remove the `temporary` entries for `src/editor/previewAspect.ts` and `src/editor/upgradeSessionAssets.ts` (named in the registry with `until: mutation-reinclude-small`)
- [ ] Kill survivors through public APIs until each file reaches 85
- **Done when:** these two files are mutated on both runs with no NoCoverage, and each scores at least 85.
- **Size:** ~300 changed lines (target ~1000, max 1500 incl. tests)
- **Out of scope:** thin worker shims (`photo.worker.ts`, `hash.worker.ts`, `bookLoad.worker.ts`) stay permanent Stryker bangs (not re-included here).
- **Source:** #72 B
- **Reason:** owner 2026-10-27: product first (finish the editor on the kit v0.9.3 chrome, then the personal site); quality-gate and audit work waits until the owner re-adds it.
