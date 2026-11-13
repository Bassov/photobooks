## Implementation

- [x] 1. `src/publish/publisher.ts`: `Publisher` (`target`, `capabilities`, `publish`, `check`), `PublisherCapabilities` (immutable cache headers, max parallel uploads, deletes), shared input/progress/result types, `createPublisher`. Test: `r2Publisher.test.ts` `createPublisher`.
- [x] 2. `src/publish/r2Publisher.ts`: the R2 target over `publishSite` / `checkConnection`; `publishSite` reads its put window from `R2_CAPABILITIES`. Tests: `publishSite.test.ts` (unchanged but for type imports).
- [x] 3. Callers through the interface: `publish.worker.ts` (`createPublisher(...).publish`) and `connectHosting` / `recheckHosting`, moved to `hosting.ts` (`createPublisher(...).check`). Tests: `publish.worker.test.ts`, `checkConnection.test.ts` (import moved).
- [x] 4. `publisherContract.test-helpers.ts` shared contract suite with a target factory; `r2Publisher.test.ts` runs it against `fakeR2.test-helpers.ts`.

## Manual test scenarios

N/A: no UI change. The existing publish e2e covers the worker path in CI.
