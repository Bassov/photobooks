## Implementation

- [x] 1. `src/core/pageNumbers.ts`: `formatPageNumber`, `pageNumberItems`, `pageNumberPosition`, `folioText`, `spreadFolios`, `syncPageNumbers`, `setParentPageNumbers`, `setPageNumbering` + exports (`src/core/pageNumbers.test.ts`)
- [x] 2. `applyBookOp.ts`: `setParentPageNumbers` / `setPageNumbering` ops; trim and grid ops wrapped in `syncPageNumbers` (`page number ops` tests)
- [x] 3. `ResolvedSpread.folios` in `types.ts` / `resolveSpread.ts` with cache keys (`resolveSpread folios` tests)
- [x] 4. Undo: `pageNumbering` in the history snapshot and restore; op labels (`bookStore history: page numbers`)
- [x] 5. Tests: unit + PBT (1000 runs) in `pageNumbers.test.ts`, bookStore undo test; `stryker:diff` 100 %

## Manual test scenarios

N/A (no UI; code review only).
