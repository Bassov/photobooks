## Implementation

- [x] 1. Worker: `returnSource` request flag; `sourceBuffer` only when asked, in the transfer list (`src/photo/processPhoto.ts`, `src/photo/photo.worker.ts`, `src/photo/assetPool.ts`). Evidence: `processPhoto.test.ts` "returnSource", `photo.worker.test.ts` "transfers sourceBuffer", `assetPool.test.ts` "returnSource". `photo.worker.ts` re-included in mutation (`stryker.config.mjs`, `stryker.mutate.md`).
- [x] 2. Import: request + seed source bytes only for memory-backed roots; FSA roots keep only identity-keyed DerivedCache puts (`src/editor/importPhotos.ts`, `src/editor/seedLibraryImport.ts`). Evidence: `importPhotos.identity.test.ts` "FSA root" / "memory root" / "session import", `seedLibraryImport.test.ts`.
- [x] 3. Spec delta `asset-source` "Import decode reuses one body read for library seed".
- [x] 4. `frame-budget gates` scenario: 16 × `large-24mp.jpg` folder import while the filmstrip scrolls, 0 LoAF (`e2e/filmstrip.spec.ts` "24 MP folder import while scrolling stays at 0 LoAF"; 3/3 local runs 0 entries).

## Manual test scenarios

N/A: no UI change; the perf scenario covers the browser path.
