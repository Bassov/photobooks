## Implementation

- [x] 1. Unit repro tests (LRU eviction / replace and thumb replace with a mounted `<img>`) that fail on main. `src/photo/objectUrlLru.test.ts` "a URL still referenced by a mounted element", `src/editor/thumbCache.test.ts` "a replaced thumb an img still shows…": 3 failed on main code, pass after 0d043f9e.
- [x] 2. `src/lib/objectUrlRevoke.ts`: revoke-when-unused with per-task DOM reference snapshot and 1 s pending re-check (`src/lib/objectUrlRevoke.test.ts`).
- [x] 3. Route `objectUrlLru`, `thumbCache`, `loadPhoto`, `useCachedCoverUrl` revokes through it; LRU cap test (`size` stays 2 at capacity 2).
- [x] 4. e2e `e2e/blob-url-revoke.spec.ts`: swap drags + reload + reopen, 0 `requestfailed` on `blob:` (passed locally, 1.8 min).

## Manual test scenarios

1. Import ≥12 photos, place 4, swap two by frame drag, save, reload, reopen the book from the library: no `ERR_FILE_NOT_FOUND` for `blob:` in the console. No UI change: covered by `e2e/blob-url-revoke.spec.ts` (OK, 0 failed blob requests); manual-qa not run.
