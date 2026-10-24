## Implementation

- [x] 1. Spec deltas: derived-cache / filmstrip / image-tiers / asset-source (+ editor-shell hydrate) — under `openspec/changes/cache-key-mtime/specs/`
- [x] 2. `cacheKeyFromIdentity` + `getAssetCacheKey`; wire thumb/tier put+hydrate to identity key
- [x] 3. Remove content-hash jobs from seed/upgrade/import/reload paths; put caches when identity+bytes ready; keep pending-put tracker for Save
- [x] 4. Delete/adjust dead hash APIs/tests; keep optional schema `contentHash` for old books
- [x] 5. Unit: key stability; identity put/hydrate; no `hashContent` on seed/upgrade/rescan verify
- [x] 6. e2e green: open-save bulk reload + fresh Open hydrate; filmstrip coverage

## Manual test scenarios

1. Import folder, Save, reload: filmstrip thumbs + placed frames hydrate without waiting on content hashing.
2. Change a file’s size/mtime on disk, rescan/reload: that asset regenerates preview; unchanged assets still hydrate.
3. Open a book saved under old contentHash-keyed cache: book loads; thumbs may regenerate once (no crash).
4. N/A multi-folder / unsupported browser.
