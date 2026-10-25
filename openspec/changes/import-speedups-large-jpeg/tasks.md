## Implementation

- [x] 1. Specs: update image-tiers / filmstrip / asset-source / photo-card for lazy JPEG, deferred 1280 on bulk, single body-read, import-time decode cap.
- [x] 2. Generalize defer-until-now for JPEG (share HEIC path); EXIF/placeholder until promote; tests (`assetPool.test.ts` lazy JPEG).
- [x] 3. Bulk/prefetch import: encode 320 only; build 1280 on placement/pasteboard/need; tests (`dualTiersDefaultForImport`).
- [x] 4. Single body read: pass worker bytes into `seedAndHashEntry`; skip second full read; tests (`importPhotos.identity.test.ts`).
- [x] 5. Import-time decode concurrency 6–8 with existing backoff; idle cap unchanged; tests (`decodeQueuePolicy` / `getEffectiveDecodeSlotLimitForTests`).
- [x] 6. Ensure visible-window promote outranks start-ordered background (tail scroll); cover in unit tests (`promotes deferred tail JPEG`).

## Manual test scenarios

1. Empty gallery → Choose photo folder → first viewport shows EXIF/placeholder tiles (happy).
2. Scroll filmstrip mid and to end during/after import — visible tiles upgrade; only filmstrip scrollport scrolls (no page H/V).
3. Place a photo on pasteboard — 1280 working preview appears (progressive thumb ok).
4. N/A synthetic: unit coverage when large multi-MB fixtures unavailable locally.
