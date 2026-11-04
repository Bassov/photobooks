## Implementation

- [x] 1. Core: `SavedTemplate` type, `applyCustomLayout` `pages` guard, op field, add-only exports; `custom.test.ts` + `custom.pbt.test.ts` (same spread ±0.01 mm, page 1 → last page aspect ±0.001, mismatch no-op; 1000 runs each)
- [x] 2. `library.json` v3 with lenient `templates` (`libraryDocument.ts`, `types.ts`, memory adapter, contract expectations); `libraryDocument.test.ts` (round-trip PBT, drop-invalid, v0/v1/v2 → v3, legacy parse)
- [x] 3. Store over `library.json`: bind / reload on library switch, serialized writes through `updateLibrary`, one-time legacy import, kit seed (`savedTemplates.ts`, `projectSession.ts`); `savedTemplates.test.ts`, `projectSession.test.ts`
- [x] 4. Shape-aware `layoutCatalog` (`layoutRects`, `applyLayout`, `templateName`); `layoutCatalog.test.ts`; `LayoutSection.saved.test.tsx` single-page apply gets `pages: 1`
- [x] 5. e2e: the "saved template persists" test reloads a `?testLibrary=1` library and reads its `library.json` (`e2e/design-r2-layout-picker.spec.ts`)

## Manual test scenarios

N/A: no visible UI change (code review only, per the brief).
