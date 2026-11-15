## Implementation

- [x] 1. `preflight.ts`: 8 cover rule ids, `scope` + `edit-cover` in the rule table, `cover` option, cover issues (front photo, dpi, colour, spine). Evidence: `preflight.test.ts` `cover rules`.
- [x] 2. `preflightText.ts`: `PreflightRow.scope`, cover rule texts. Evidence: `preflightText.test.ts` "words the cover rules as the Designer table".
- [x] 3. `pdfFileName.ts`: `pdfCoverFileName`; barrel exports. Evidence: `pdfFileName.test.ts` `pdfCoverFileName`.
- [x] 4. Unit + PBT tests for the three files. Evidence: `preflight.pbt.test.ts`, `preflightText.pbt.test.ts` cover properties.

## Manual test scenarios

N/A: core only, no UI change.
