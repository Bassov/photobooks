## Implementation

- [ ] 1. Unit repro tests (LRU eviction / replace and thumb replace with a mounted `<img>`) that fail on main.
- [ ] 2. `src/lib/objectUrlRevoke.ts`: revoke-when-unused with per-task DOM reference snapshot and 1 s pending re-check.
- [ ] 3. Route `objectUrlLru`, `thumbCache`, `loadPhoto`, `useCachedCoverUrl` revokes through it; LRU cap test.
- [ ] 4. e2e `e2e/blob-url-revoke.spec.ts`: swap drags + reload + reopen, 0 `requestfailed` on `blob:`.

## Manual test scenarios

1. Import ≥12 photos, place 4, swap two by frame drag, save, reload, reopen the book from the library: no `ERR_FILE_NOT_FOUND` for `blob:` in the console.
