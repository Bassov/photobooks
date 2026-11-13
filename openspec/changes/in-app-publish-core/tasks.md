## Implementation

- [x] 1. `r2Errors.ts` classifier + messages; `checkConnection.ts` uses it (`r2Errors.test.ts`, `checkConnection.test.ts` unchanged)
- [x] 2. `r2Request`: `GET` and a signed `cache-control` header (`r2Sign.test.ts`)
- [x] 3. `publishSite.ts`: manifest GET, grouped 4-in-flight puts, deletes, manifest PUT, P4 retry, P5 partial manifest, P6 headers (`publishSite.test.ts`)
- [x] 4. `publish.worker.ts` + `createPublishWorker.ts`: render → hash → credentials from IDB → publish → status, throttled progress (`publish.worker.test.ts`)
- [x] 5. `importBoundary.test.ts`: only `publish.worker.ts` among workers reaches `credentials.ts`

## Manual test scenarios

N/A — no UI; the worker is driven by unit tests until `in-app-publish` adds the dialog.
