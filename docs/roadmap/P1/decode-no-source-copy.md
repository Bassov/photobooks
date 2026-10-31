# decode-no-source-copy

Tag: prep
Milestone: P1
Title: Decode worker: stop copying the original file to the main thread

## Scope

- [ ] Worker (`src/photo/processPhoto.ts`, `src/photo/photo.worker.ts`): return `sourceBuffer` only when the request asks for it (`returnSource: true`), and put it in the `postMessage` transfer list when present. Today it is structured-cloned: a 10–25 MB copy per photo that lands on the main thread.
- [ ] Import (`src/editor/importPhotos.ts` `applyImportResult` → `src/editor/seedLibraryImport.ts`): request and seed source bytes only when the root's registered `AssetSource` is a memory source. For FSA roots `memorySourceForRoot` returns a fresh unregistered memory source and `seedFile` copies the bytes again (`src/assets/memory.ts` `slice(0)`), then drops them. FSA roots keep only the identity-keyed DerivedCache puts.
- [ ] Spec delta `asset-source` "Import decode reuses one body read for library seed": the seed applies to memory-backed roots; FSA-backed roots skip it (files re-resolve from the folder handle).
- [ ] New `frame-budget gates` scenario in `e2e/filmstrip.spec.ts`: folder of 16 copies of `e2e/fixtures/large-24mp.jpg` imported while the filmstrip scrolls, 0 LoAF.
- **Why:** decode bench 2026-10-31 (`.local_dev/decode-bench-2026-10-31/REPORT.md` in the main checkout): the source copy costs 5–26 ms of main thread per photo; at 45 MP, 6–7 LoAF per 32 photos with 136–233 ms blocking. Without it: 0 LoAF.
- **Done when:** unit tests show an FSA-root import result without `sourceBuffer` and no `seedFile` call, and a memory-root import still seeds once from the decode bytes (no second `arrayBuffer`); the new scenario is at 0 LoAF; existing import / library / reload e2e green.
- **Test:** unit (worker response, seed branch) + the new perf scenario
- **Hard nos:** no new dependency; no change to DerivedCache keys
- **Depends:** none
