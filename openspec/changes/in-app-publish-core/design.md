## Decisions

1. `r2Errors.ts`: one classifier for a response or a thrown fetch, plus a redacted message builder; `checkConnection` keeps its messages. `r2Request` gains `GET` and a signed `cache-control`.
2. `publishSite` (injected `fetch` / `now` / `sleep` / `isOnline`): 4 puts in flight per kind group; the first failure stops new requests, then the partial manifest (old ∪ put − deleted) is written. The old manifest drops `_photobooks/` and invalid keys, so deletes stay inside it.
3. P4 per Spec; a 429 `Retry-After` is capped at 10 s. P6: html / json `no-cache`, a last segment with ≥ 16 hex immutable.
4. Worker (P8): request `{input, bookId?}`, no credentials; `runPublish` is exported for tests. P9 writes status only on success or `key` / `denied` / `bucket`. Progress throttled 250 ms.
5. Security: only `publish.worker.ts` among workers reaches `credentials.ts` (boundary test); a PBT checks no post carries the key id or secret.

## Touch-set & Test Plan

| Path                                      |
| ----------------------------------------- |
| `src/publish/r2Errors.ts`                 |
| `src/publish/r2Errors.test.ts`            |
| `src/publish/checkConnection.ts`          |
| `src/publish/r2Sign.ts`                   |
| `src/publish/r2Sign.test.ts`              |
| `src/publish/publishSite.ts`              |
| `src/publish/publishSite.test.ts`         |
| `src/publish/publish.worker.ts`           |
| `src/publish/publish.worker.test.ts`      |
| `src/publish/createPublishWorker.ts`      |
| `src/publish/createPublishWorker.test.ts` |
| `src/publish/importBoundary.test.ts`      |
| `src/publish/fakeR2.test-helpers.ts`      |

- Tests: unit + PBT with a Map-backed fake R2 and a virtual sleep; `checkConnection.test.ts` unchanged. No e2e (no UI).
