## Implementation

- [x] 1. Browser fake: per-file versions; stale `File` snapshots reject `NotReadableError`; `onSnapshot` hook (`src/project/fsa/browserDirectory.test-helpers.ts`, d15160e4)
- [x] 2. `handles.ts` `getText` re-snapshots on `NotReadableError` (≤4 reads); unit tests for overlap, give-up, other errors (`src/project/fsa/handles.test.ts`, d15160e4)
- [x] 3. `e2e/fixtures/opfsText.ts`; `storedSite`, `exportedHome`, `readTestLibraryJson` use it (`site-settings.spec.ts --repeat-each=10`: 30 passed, d15160e4)
- [x] 4. Library-storage spec: reads overlapped by a write return a whole file (`openspec/specs/library-storage/spec.md`, d15160e4)

## Manual test scenarios

N/A (storage read path, no UI change; covered by `e2e/site-settings.spec.ts --repeat-each=10`).
