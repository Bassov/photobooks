## Implementation

- [x] 1. Tests first: unit `src/photo/assetPool.retry.test.ts` and e2e `e2e/filmstrip-stuck-thumbs.spec.ts` (fling during / after import of 600 JPEGs, stop, walk); both fail on `origin/main`
- [x] 2. Pool retry delivers to its owner (`onRetryResult`; import batch wires `onResult`)
- [x] 3. Retry seeds drop a stale aborted signal (pre-aborted call, deferred promotion); a retry for an asset already in now runs at once
- [x] 4. Only a same-tier decode clears a parked retry

## Manual test scenarios

1. Import a 1000-JPEG folder, fling the strip back and forth during the import, stop: every tile in view shows its thumb within 5 s.
2. Same after the import has finished.
