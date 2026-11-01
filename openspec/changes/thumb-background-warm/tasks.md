## Implementation

- [x] 1. `DerivedCache.has` existence check (OPFS handle, no read; memory) + contract test
- [x] 2. Pool: `backgroundWarm` bypasses lazy defer, `promoteDeferredLazyToWarm`, one warm slot while scroll-quiet, export the effective slot limit
- [x] 3. `filmstripVisibleSync`: 100 ms throttled publish during scroll, velocity extension, window store for the warm lane
- [x] 4. Warm lane module (order, idle-only, cap, skip cached, no HEIC retry) + `EditorShell` install + e2e seam
- [x] 5. Spec deltas: filmstrip / image-tiers / asset-source / photo-card
- [x] 6. e2e idle 200-JPEG folder + HEIC, perf scroll + pan scenario

## Manual test scenarios

1. New folder with 1000+ large JPEGs, wait ~1 min, fling the strip end to end: no gray tiles; scroll and canvas pan stay smooth while thumbs are made.
