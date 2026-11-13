## Decisions

1. `r2Errors.ts`: `classifyR2Failure({status, body} | {timedOut, online})` → `{code, status?, s3Code?}` and `r2FailureMessage(failure, credentials, mode, timeoutMs)` (redacted). `checkConnection` keeps its fields map and messages.
2. `publishSite(input, deps)`: deps `fetch` / `now` / `sleep` / `isOnline`. Puts run 4 at a time per kind group (asset → json → html); the first failure stops new requests, in-flight ones settle, then the partial manifest (old ∪ put − deleted) is written best effort. A malformed or missing manifest reads as `{}`; keys under `_photobooks/` or with empty / `.` / `..` segments are dropped, so deletes never leave the old manifest.
3. P4: transient = TypeError while online, 408, 429, 5xx, 30 s timeout (raced against `sleep`). Waits 1 s, 3 s; a 429 `Retry-After` is used, capped at 10 s.
4. P6: html / json → `no-cache`; another key whose last segment holds ≥ 16 hex → immutable; rest `no-cache`; manifest `no-store`. Content-Type from a fixed extension map.
5. Worker (P8): the request is `{input, bookId?}` — no credentials; `runPublish(request, post, deps)` is exported for tests. No stored credentials → `failed: unconnected`; a build error → `failed: render`. P9 writes the status only on success or `key` / `denied` / `bucket`. Progress `render` (files hashed), `upload` (bytes), `finish` (deletes + manifest), throttled 250 ms.
6. Security: the only worker reaching `credentials.ts` is `publish.worker.ts` (boundary test); a PBT checks no post carries the key id or secret.

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
| `src/publish/index.ts`                    |

- Reuse: `planUpload`, `hashSiteFiles`, `r2Request`, `redact`, `createCredentialStore`, `buildSiteTree`.
- Tests: unit + PBT with a fake R2 (Map-backed fetch) and a virtual sleep; `checkConnection.test.ts` unchanged. No e2e (no UI).
