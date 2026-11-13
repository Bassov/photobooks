# publish-site-flaky-2

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item publish-site-flaky-2
Status: done

## Scope

Unit test `src/publish/publishSite.test.ts` "publishSite: P4 retry > puts at most 4 at a time and starts no new put after a failure" still flakes on CI after #582 (run 43464692232, PR #584: `expected 3 to be 4` on `healthy.maxInFlight`). The P4 contract holds (up to 4 puts in flight whenever ≥4 remain, no new put after a failure); the cause is in `src/publish/publishSite.ts`. Lane: `src/publish/**` only.

- [x] `publishSite` put / delete pool: a request is signed before its slot opens, so the first 4 go out together and a refill goes out as soon as its slot frees; the in-order window and "no new put after a failure" from #582 stay
- [x] Deterministic PBT: with 4 or more puts left, 4 are on the wire at every step and at the first reply
- **Done when:** the P4 test passes 300/300 in a loop locally, also with a second loop in parallel; the new test passes every run; the #582 regression test and other publishSite / r2Errors / checkConnection tests stay green, unchanged in meaning.
- **Browser check:** N/A (worker upload loop; covered by unit tests)
- **Hard nos:** no edits to the existing tests' assertions; nothing outside `src/publish/**`.
