## Implementation

- [x] 1. `src/core/schema.ts`: version 11, optional `printProfile {id, overrides}` and `cover.print {spineWidthSource}` (`printProfile.test.ts` "print fields in the schema")
- [x] 2. `src/core/printProfile.ts`: built-in `generic` profile, resolve (profile + overrides), trim / bleed validation; defaults on new library books and `defaultCover` (`printProfile.test.ts`, `cover.test.ts`)
- [x] 3. `src/core/migrate.ts`: v10 → v11 adds the default profile and cover print fields (`migrate.test.ts`, `printModel.pbt.test.ts`)
- [x] 4. Tests: unit for profile validation of trim / bleed; PBT (≥1000 runs) migrate idempotent and parse(serialize) round-trip with the new fields (`printModel.pbt.test.ts`)

## Manual test scenarios

N/A (no UI; unit + PBT only).
