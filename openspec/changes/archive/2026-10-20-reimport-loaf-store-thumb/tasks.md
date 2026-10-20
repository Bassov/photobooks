## Implementation

- [x] 1. `patchAssetRecord` no-ops when the merge leaves the existing asset unchanged — no emit / spread notify
- [x] 2. `flushPendingGalleryAndMeta`: identical `sessionMeta` entries skip map replace and emit when gallery/book also unchanged
- [x] 3. `thumbCache`: dedupe DerivedCache thumb puts by `contentHash`; clear on `resetThumbCache`
- [x] 4. Unit tests; `pnpm check` (incl. line-scoped `stryker:diff`) green
- [x] 5. Existing library re-import scroll LoAF e2e stays 0; budgets unchanged

## Manual test scenarios

N/A — prep store/cache LoAF hardening; re-import LoAF remains gated by existing `e2e/filmstrip.spec.ts` library re-import scenario.
