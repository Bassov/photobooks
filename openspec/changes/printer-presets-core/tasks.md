## Implementation

- [ ] 1. `catalog.ts` built-ins (Generic + sourced shops A→Z, none confirmed this run) with source / checked shape tests
- [ ] 2. `printProfile.snapshot` in the book schema; D6 resolution (`resolvePrintProfile`, `bookPrintProfile`, DPI, validation, cover geometry) + unit / PBT
- [ ] 3. D5 `pageCountRange` / `clampPageCount(n, range)`; `setPageCount` clamps to the book profile + unit / PBT
- [ ] 4. `printIssues` page-count issues; `profileText.ts` strings and `editableProfileIssues` + unit
- [ ] 5. Op `setPrintProfile` (D4) + unit / PBT
- [ ] 6. `library.json` v4 `printProfiles` / `defaultPrintProfileId` + migration, memory adapter, contract tests
- [ ] 7. New books use the library default profile (`projectSession.ts`) + unit

## Manual test scenarios

N/A: core only, no UI change (Generic keeps Pages 20–120 and B/S 3 / 5).
