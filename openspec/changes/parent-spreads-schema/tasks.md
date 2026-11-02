## Implementation

- [x] 1. Schema v10 (`src/core/schema.ts`): book `parents?`, `defaultParentId?`, `pageNumbering?`; parent shared frames, guides, partial `layoutGrid`, `pageNumbers` items; spread `parentId?` (null = None) and `parentOverrides?` (hidden ids, local frame / guide copies with `overridesId`)
- [x] 2. Migration v9 → v10 (`src/core/migrate.ts`): version bump, no field dropped; round-trip test on every v1–v9 fixture (`src/core/migrate.test.ts` `v9 to v10 (parent spreads)`)
- [x] 3. Pure resolver (`src/core/parentSpreads.ts`): parent lookup, grid chain book → parent → spread, guides and frames minus hidden / overridden plus the spread's own on top; unit + PBT (≥1000 runs per property) (`src/core/parentSpreads.test.ts`)

## Manual test scenarios

N/A (no UI; prep).
