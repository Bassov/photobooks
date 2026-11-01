# decode-slot-busy-until-reply

Tag: prep
Milestone: P1
Title: Decode pool: keep in-flight thumbs, never double-book a worker

## Scope

- [x] `src/photo/assetPool.ts` `runDecodeOnSlot`: after an abort the slot stays busy until the worker replies for that request id. The worker cannot cancel; today `settle` frees the slot at once, the next job is posted onto a worker that is still decoding (two decodes in one worker, double memory), and the finished result is thrown away.
- [x] A thumb320 job already in flight when its asset leaves the now set runs to completion and its result is published and stored (`setThumbUrl` + identity DerivedCache put). Only queued jobs are dropped or relabelled. In-flight 1280 working-preview jobs keep today's abort.
- [x] Spec delta: `filmstrip` "Visible-window decode priority", `asset-source` "Visibility must not abort off-screen import jobs", `image-tiers` "Cancelling a preview job does not abort import": leaving now drops queued thumb jobs; an in-flight thumb320 finishes and is kept; re-entry without a hot thumb still enqueues at now.
- **Why:** one 10–25 MB JPEG decode costs 0.1–0.4 s of worker CPU (decode bench 2026-10-31); dropping it on every scroll stop wastes the pool.
- **Done when:** unit tests with fake workers: abort during in-flight keeps `busy` until the reply; no job is posted to a busy worker; an in-flight thumb whose asset left now still resolves and publishes; queued off-now jobs are still dropped; re-entry still enqueues at now. Existing filmstrip decode-priority e2e green.
- **Test:** unit (`assetPool`, `decodeScheduler`)
- **Hard nos:** no pool size change
- **Depends:** decode-no-source-copy
