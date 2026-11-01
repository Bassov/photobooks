## Implementation

- [ ] 1. `runDecodeOnSlot`: the job settles once (an abort rejects at once), and the slot frees only on the worker reply or error for that request id (`src/photo/assetPool.ts`).
- [ ] 2. Leave-now marks in-flight thumb320 jobs (`keepsInFlightOnLeaveNow`) so they ignore the abort, resolve and publish via `onResult`. Queued jobs are still dropped with a pending retry (`src/photo/assetPool.ts`, `src/photo/decodeScheduler.ts`).
- [ ] 3. Fake-worker unit tests: busy until reply, no post to a busy worker, an in-flight thumb that left now publishes, queued off-now jobs drop, re-entry enqueues at now (`src/photo/assetPool.inflight.test.ts`, `decodeScheduler.test.ts`).
- [ ] 4. Spec deltas: `filmstrip`, `asset-source`, `image-tiers`.

## Manual test scenarios

N/A: no UI change. The existing filmstrip decode-priority e2e is the browser check.
