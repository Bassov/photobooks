## Decisions

1. **Durable key = identity digest:** `cacheKeyFromIdentity({ sourceRootId, relativePath, byteSize, mtimeMs })` → sync 64-hex SHA-256 of a canonical string. DerivedCache `(assetHash, presetId)` API unchanged; `assetHash` is this digest, not file-byte SHA-256.
2. **No content-hash on hot paths:** Drop `hashContent` from `seedAndHashEntry`, adopt upgrade, and reload/rescan. Optional book `contentHash` remains parseable for old JSON but is unused for cache put/get. Meta change ⇒ new key ⇒ miss/regenerate; no migration.
3. **Put/hydrate by identity:** `getAssetCacheKey` / `setThumbUrl` / `ensureThumb` / `requestTier` use the metadata digest when identity is complete. Encode-after-identity puts still go through `trackHashJob`/`awaitPendingHashes` so Save waits for OPFS settle (tracker name kept; jobs are cache puts).
4. **Security:** Keys and OPFS filenames derived from already-persisted path/size/mtime (+ root id); no new picker or body trust. Stale byte-hash OPFS rows may linger until normal eviction.

## Touch-set & Test Plan

- Files: `src/assets/cacheKey.ts` (+ sync digest), `thumbCache`/`tierCache`, `bookStore.getAssetCacheKey`, `seedLibraryImport`, `upgradeSessionAssets`, Filmstrip/ConnectedSpreadView, pending-put comments; specs derived-cache/filmstrip/image-tiers/asset-source (+ editor-shell hydrate wording).
- Reuse: DerivedCache adapters/presets; identity fields; `trackHashJob` for put settle.
- Tests: unit — cacheKey stability; put/hydrate by identity; seed/upgrade no `hashContent`; folderRescan. e2e — open-save `:204`/`:268` (+ session attach hydrate). Measure reload body-reads/`hashContent` before/after for PR body. No gate relaxations.
