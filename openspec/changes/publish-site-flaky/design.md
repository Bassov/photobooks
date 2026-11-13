## Decisions

1. Race: `inPool` gave the next item to whichever lane freed up first, so a failure that replied after its neighbours let items 4 and 5 start. Fix: an in-order window. Item k starts only after item k−4 settles and no item has failed, so a failure on item i stops every item from i+4 on, whatever the reply order.
2. A put already in flight that succeeds counts in `sent` and the partial manifest (it is on R2). A put that never started is never counted.
3. Deletes share the pool and get the same guarantee.
4. Retries of an in-flight put continue after another put fails. That is the same key, not a new put.

## Touch-set & Test Plan

| File                              | Why                                |
| --------------------------------- | ---------------------------------- |
| `src/publish/publishSite.ts`      | `inPool` in-order window           |
| `src/publish/publishSite.test.ts` | delayed-403 test + reply-order PBT |

- Reuse: the `createFakeR2` override with async delays; `storedManifest`.
- Tests: see tasks 1–2. The existing P4 test is untouched and passes 200/200 in a local loop.
