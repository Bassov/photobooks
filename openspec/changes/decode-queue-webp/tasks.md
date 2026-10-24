## Implementation

- [x] 1. Spec deltas: image-tiers (dual WebP encode, cancel≠import abort), derived-cache (WebP MIME + legacy JPEG hydrate), filmstrip/asset-source (now/background + cancel+re-enqueue; remove “never abort off-screen”), frame-budget unchanged LoAF=0
- [x] 2. Pure helpers: dual-lane priority ordering; `decodeWorkerCount` + backoff concurrency; idle-schedule seam for background pump
- [x] 3. Worker: one original decode → 320 + 1280 `image/webp` (~0.8); extend request/response; always WebP for new encodes
- [x] 4. assetPool: now vs background queues; idle-only background; AbortController cancel on leave-now; re-enqueue on re-enter; adaptive effective slots; keep HEIC deferral + #198 quiet paths
- [x] 5. Import/tier/thumb: dual-tier publish + DerivedCache put both presets; hydrate working preview from cache; legacy JPEG rows still display
- [x] 6. Unit tests for (2)–(5); keep filmstrip / open-save / frame-budget e2e green

## Manual test scenarios

1. ~2k JPEG folder first import: visible tiles get thumbs quickly; off-screen decode jobs cancel during fast scroll and resume when scrolled back.
2. After import of one file: DerivedCache has both thumb + tier-1280 WebP; placing on pasteboard does not re-decode the original when cache hits.
3. Reload with OPFS thumbs present (incl. pre-change JPEG rows): filmstrip hydrates without re-encode.
4. N/A non-Chromium / multi-folder.
