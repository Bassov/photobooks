## Implementation

- [ ] 1. Browser fake: per-file versions; stale `File` snapshots reject `NotReadableError`; `afterSnapshot` hook
- [ ] 2. `handles.ts` `getText` re-snapshots on `NotReadableError` (≤4 reads); unit tests for overlap, give-up, other errors
- [ ] 3. `e2e/fixtures/opfsText.ts`; `storedSite`, `exportedHome`, `readTestLibraryJson` use it
- [ ] 4. Library-storage spec: reads overlapped by a write return a whole file

## Manual test scenarios

N/A (storage read path, no UI change; covered by `e2e/site-settings.spec.ts --repeat-each=10`).
