## Implementation

- [x] 1. `src/core/print/profileSchema.ts`: Zod printer profile schema (trim, page / cover bleed, safe margin, page count `{min, step, max}`, single first page, printed endpapers, spine formula | table + manual override, `output`, crop marks default off, sRGB, file limits, DPI warn / min, min font size) and the built-in `generic` profile. Evidence: `src/core/print/profileSchema.pbt.test.ts`.
- [x] 2. `printProfile.ts` resolves the full profile (overrides on trim / bleed); `bookDpiThresholds(book)` falls back to `DPI_WARN` / `DPI_MIN`. Evidence: `src/core/printProfile.test.ts`.
- [x] 3. `lowDpi(dpi, thresholds)`; `resolveSpread`, `PhotoSection`, `pageFillLowRes` / `FilmstripItem` pass the book's thresholds. Evidence: `src/core/geometry/dpi.test.ts`, `src/editor/pageFillLowRes.test.ts`.
- [x] 4. Tests: PBT parse / JSON round-trip (≥100 runs) + invalid profiles rejected; ≥3 hand-computed effective-DPI fixtures (quarter-turned pixels, frame size, crop zoom) through profile thresholds. Evidence: `src/core/print/profileDpi.test.ts`.

## Manual test scenarios

N/A (no UI; core data model only).
