## Implementation

- [x] 1. Profile fields `coverWrapMm` / `coverHingeMm`; zod-free `genericProfile.ts` (wrap 15, hinge 8, spine 8 + 0.2 mm/page) exported by `index.ts`; `printProfile.ts` imports it. Evidence: `src/core/print/profileSchema.pbt.test.ts` ("generic print profile", "negative cover wrap/hinge"), `src/core/printProfile.test.ts`.
- [x] 2. `coverGeometry.ts`: `spineWidthMm`, `coverGeometry`, `bookCoverGeometry` with rects; unit + PBT. Evidence: `src/core/print/coverGeometry.test.ts`.
- [x] 3. `pages.ts` delegates `bookSpineWidthMm`; constants and `spineWidthForPages` removed; `index.ts` exports. Evidence: `src/core/pages.test.ts` "spine width".
- [x] 4. `clearRemovedCoverAssets` keeps `cover.print` (regression test). Evidence: `src/core/cover.test.ts` "removing the cover photo keeps a manual spine".
- [x] 5. Update `pages.test.ts`, `profileSchema.pbt.test.ts`, `printProfile.test.ts`. Evidence: `pnpm check:fast` green, `pnpm stryker:diff` green.

## Manual test scenarios

N/A: core only, no UI change (the drawn spine stays 12 mm at 20 pages; covered by unit tests).
