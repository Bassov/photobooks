# publish-site-flaky

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item publish-site-flaky
Status: done

## Scope

Unit test `src/publish/publishSite.test.ts` "publishSite: P4 retry > puts at most 4 at a time and starts no new put after a failure" flakes on CI (run 43432604339, PR #579: expected `sent: 3`, received `sent: 5`). The contract is right (at most 4 in flight, no new put after a failure, `sent` = puts confirmed before the stop); the race is in `src/publish/publishSite.ts`. Lane: `src/publish/**` only.

- [x] `publishSite` put / delete pool: a new request starts only when its place in the queue is free whatever order R2 replies come back in, so a failure on an earlier put stops every later one; `sent` and the partial manifest count only puts that succeeded
- [x] Deterministic test that delays the failing reply until after the other puts reply (race covered every run) plus a PBT over reply orders
- **Done when:** the P4 test passes 200/200 in a loop locally with the fake R2 replies in any order; `sent` after a stop equals the puts that succeeded before the stop decision and the partial manifest lists only those; other publishSite / r2Errors / checkConnection tests stay green, unchanged in meaning.
- **Browser check:** N/A (worker upload loop; covered by unit tests)
- **Hard nos:** no edits to the test's assertions; nothing outside `src/publish/**`.
