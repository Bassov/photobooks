## Implementation

- [x] 1. `runDecodeOnSlot`: the job settles once (an abort rejects at once), and the slot frees only on the worker reply or error for that request id (`src/photo/assetPool.ts`). Evidence: `assetPool.inflight.test.ts` "keeps the slot busy after a caller abort until the worker replies".
- [x] 2. Leave-now marks in-flight thumb320 jobs (`keepsInFlightOnLeaveNow`) so they ignore the abort, resolve and publish via `onResult`. Queued jobs are still dropped with a pending retry (`src/photo/assetPool.ts`, `src/photo/decodeScheduler.ts`). Evidence: "keeps an in-flight thumb whose asset left now and publishes it".
- [x] 3. Fake-worker unit tests: busy until reply, no post to a busy worker, an in-flight thumb that left now publishes, queued off-now jobs drop, re-entry enqueues at now (`src/photo/assetPool.inflight.test.ts`, `decodeScheduler.test.ts`). Evidence: 6 tests, all failing cases on origin/main code; `e2e/filmstrip.spec.ts` 34/34 green.
- [x] 4. Spec deltas: `filmstrip`, `asset-source`, `image-tiers` (also synced into `openspec/specs/`).

## Manual test scenarios

N/A: no UI change. The existing filmstrip decode-priority e2e is the browser check.
