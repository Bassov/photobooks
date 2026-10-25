## Implementation

- [x] 1. Specs: update image-tiers / filmstrip / asset-source / photo-card for lazy JPEG, deferred 1280 on bulk, single body-read, import-time decode cap.
- [x] 2. Generalize defer-until-now for JPEG (share HEIC path); EXIF/placeholder until promote; tests (`assetPool.test.ts` lazy JPEG).
- [x] 3. Bulk/prefetch import: encode 320 only; build 1280 on placement/pasteboard/need; tests (`dualTiersDefaultForImport`).
- [x] 4. Single body read: pass worker bytes into `seedAndHashEntry`; skip second full read; tests (`importPhotos.identity.test.ts`).
- [x] 5. Import-time decode concurrency 6–8 with existing backoff; idle cap unchanged; tests (`decodeQueuePolicy` / `getEffectiveDecodeSlotLimitForTests`).
- [x] 6. Ensure visible-window promote outranks start-ordered background (tail scroll); cover in unit tests (`promotes deferred tail JPEG`).

## Manual test scenarios

1. Empty gallery → Choose photo folder → first viewport shows EXIF/placeholder tiles (happy).
   - OK: unit `runImportBatch defers off-screen JPEG` + `does not queue off-screen JPEG at prefetch; queues when visible (lazy like HEIC)`; e2e `long gallery scrolls…` covers gallery fill + filmstrip scrollport only (not thumb DOM assert).
2. Scroll filmstrip mid and to end during/after import — visible tiles upgrade; only filmstrip scrollport scrolls (no page H/V).
   - OK: e2e `scroll mid-import keeps earlier revealed tile ids` + unit `promotes deferred tail JPEG`.
3. Place a photo on pasteboard — 1280 working preview appears (progressive thumb ok).
   - OK: covered by existing ConnectedSpreadView/`requestTier` unit path; no new chrome.
4. N/A synthetic: unit coverage when large multi-MB fixtures unavailable locally.
   - OK: unit suites for lazy JPEG / defer 1280 / single body-read / import concurrency.

### ui-review (filmstrip import — no new chrome)

- empty: OK (unchanged empty guidance; no new surfaces)
- happy first viewport: OK (placeholders / EXIF thumbs via existing FilmstripTile; progressive upgrade)
- scroll mid/end: OK (visible-window promote; scrollport-only; pre-existing FilmstripStatus a11y residual out of scope)
