## Decisions

1. **Lazy JPEG like HEIC:** defer full decode until now (visible ∪ book-used ∪ visible/zoom); EXIF head thumb or grey placeholder until promote.
2. **Bulk encodes 320 only:** import/prefetch → thumb320; 1280 via `requestTier` / dual-tier on pasteboard/placement/need. Edges unchanged.
3. **Single body read (security):** one full-body obtain per decoded asset — transfer/preload into `seedAndHashEntry({ bytes })`; never a second happy-path `arrayBuffer`; FSA/body-read caps unchanged; deferred assets skip body until decode.
4. **Import pool 6–8:** higher cap while import runs; idle stays lower; backoff still halves / floors to 1.
5. **Visible wins FIFO:** promote deferred at visible so filmstrip mid/tail outranks start-ordered background.

## Touch-set & Test Plan

- Files: `assetPool.ts`, `decodeQueuePolicy.ts`, `decodeScheduler.ts`, `processPhoto.ts` (+ worker), `importPhotos.ts`, `seedLibraryImport.ts`, `tierCache.ts` as needed; deltas `image-tiers` / `filmstrip` / `asset-source` / `photo-card`.
- Reuse: HEIC defer, `jpegHeadPass`, `seedAndHashEntry({ bytes })`, `requestTier`, now-set wiring; existing filmstrip/photo-card tokens (no new chrome).
- Tests: unit — lazy JPEG; bulk 320-only; seed preloaded bytes; import concurrency > idle + backoff; scroll/tail promote. e2e: empty gallery, happy import first viewport, filmstrip scroll (incl. assertNamedScrollport / no page scroll); `ui-review` before push. No LoAF/gate weaken.
