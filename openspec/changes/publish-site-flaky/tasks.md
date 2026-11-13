## Implementation

- [x] 1. Deterministic test: the failing put's 403 is held until the other 3 puts report upload progress; `sent: 3`, assets 0–3 put, and the partial manifest lists assets 1–3 (`src/publish/publishSite.test.ts`, red before the fix)
- [x] 2. PBT over random reply delays and fail index: started puts are a prefix (≥ max(4, f+1), ≤ f+4), at most 4 in flight, `sent` = started − 1, and the manifest lists the prefix minus the failed one (red before the fix)
- [x] 3. `inPool` in-order window: item k starts after item k−4 settles and only if no item has failed (`src/publish/publishSite.ts`); P4 tests 200/200 in a local loop

## Manual test scenarios

N/A: worker upload loop with no UI change. Covered by the unit tests and PBT against the fake R2.
