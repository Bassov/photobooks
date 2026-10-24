## Decisions

1. **Lanes:** `now` = filmstrip window ∪ painted spread ∪ book-used; `background` = other prefetch. Legacy `visible`/`zoom` → now; `prefetch`/`background` → background. Pump now first; background only via idle/`postTask({priority:'background'})` when now empty.
2. **Cancel + retry:** Per-job AbortController. Leave-now (not book-used) aborts queued/in-flight decode; re-enter without hot thumb re-enqueues at now. Import treats AbortError as non-failure; never abort the batch wholesale.
3. **Adaptive pool:** Slots `min(4, max(1, hwConcurrency-1))`; body-read cap separate. Pure backoff lowers effective slots on longtask/LoAF or memory pressure; restore on quiet. No gate edits.
4. **One decode → two WebP:** Worker decodes once (resize ≤1280), encodes WebP ≈0.8 for 1280 and 320. Import puts both presets; pasteboard hydrates `tier-1280` without a second original decode. Legacy JPEG rows hydrate via envelope MIME; presets unchanged.
5. **Security:** Same worker postMessage + blob/object-URL revoke discipline; cancel is AbortSignal only (no new FS APIs).
6. **HEIC:** Keep defer-until-now; dual WebP only when decode succeeds.

## Touch-set & Test Plan

- Files: `assetPool` (+ queue/backoff helpers), `processPhoto`/`photo.worker`, `tierCache`/`thumbCache`/import apply, `filmstripVisibleSync`; specs image-tiers, derived-cache, filmstrip, asset-source, frame-budget (LoAF unchanged).
- Reuse: worker pool, visible/book-used sets, body-read gate, presets, #198 scroll-quiet.
- Tests: unit — lane order; cancel+re-enqueue; sizing/backoff; single-decode dual WebP; legacy JPEG hydrate. e2e — filmstrip re-import/scroll LoAF=0; open-save thumbs. PR: TTFV, decodes/file, cancelled off-screen, OPFS bytes/thumb.
