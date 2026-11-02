## Decisions

1. **Retry owner.** `ProcessAssetOptions.onRetryResult` names who gets a pool retry's result. A leave-now abort still rejects the call (the import batch counts it done); the retry run on re-entry calls `onRetryResult`, which `runImportBatch` sets to its own `onResult` (thumb, aspect, seed). Parking the job instead was rejected: the batch awaits it and would never finish.
2. **No stale signal in a retry seed.** A call rejected for an already-aborted signal (an import chunk reaching an asset that left now earlier) seeds its retry without that signal; the pool controller still cancels it. A deferred JPEG promoted with an aborted signal also parks a retry. A retry for an asset already in now runs at once.
3. **Tier-scoped retry clear.** Only a same-tier decode (enqueue or success) clears a parked ownerless retry; a working-preview job no longer drops a thumb retry. An owned retry runs only on re-entry: its rejected owner hears from nothing else.
4. **`thumbMissDecode`** keeps deferring to a pending thumb decode: safe now that every thumb320 owner publishes. Other callers: reasons in the PR body.
5. **UI:** no visual change; `ui-review` N/A. The e2e covers the scroll path.

## Touch-set & Test Plan

- Files: `src/photo/assetPool.ts`; `src/photo/assetPool.retry.test.ts`; `e2e/filmstrip-stuck-thumbs.spec.ts`.
- Reuse: retry map, `ensureActiveAbortController`, import `onResult`, picker input + 2× CPU throttle.
- Tests: unit per tasks 1–4 (fail on `origin/main`); e2e 1000 JPEGs, fling during / after import, stop, walk (fails on `origin/main`).
