## Decisions

1. **Evolve entry index → versioned folder manifest:** Same IDB store (`source-root-entry-index`), schema `{ version: 1, entries: path → { byteSize, mtimeMs, width?, height?, orientation? } }`. No content hash. Unknown/mismatched `version` or unparsable rows → treat as missing and rebuild from scan (no crash).
2. **Manifest-first, walk always:** On granted restore, read manifest and enqueue gallery (aspects from width/height/orientation when present; identity for DerivedCache keys) **before** awaiting `scanRoot`. Then always cheap full walk; `diffEntryIndex` drives add/change/remove; never skip walk via count/max-mtime/manifest.
3. **Merge dims on persist; batch writes:** When size/mtime unchanged, keep prior width/height/orientation; when changed, drop dims (new cache key → regenerate). Writes yield in batches off the hot path so 2–4k entries do not long-task the main thread. Decode/import updates dims into the manifest asynchronously.
4. **Security:** Manifest is disposable metadata keyed by `sourceRootId`; no file bodies or handles. Clearing site data drops it; next visit rebuilds from scan.

## Touch-set & Test Plan

- Files: `sourceRootEntryIndex` (+ parse/version/dims/batch persist), `photoRootSession` (hydrate-before-scan), `enqueueScannedGalleryList` (dims→sessionMeta), import/decode dim write-back; specs asset-source + filmstrip (+ derived-cache hydrate wording if needed).
- Reuse: existing entry-index IDB/diff; `enqueueScannedGalleryList`; identity `cacheKeyFromIdentity` / `ensureThumb`; `yieldForPaint`.
- Tests: unit — manifest-first before scan resolves; diff new/changed/removed; corrupt/version fallback; batched persist. e2e — open-save reload + filmstrip stay green. Measure reload→first slots/thumbs before/after (~2k) for PR body. No gate relaxations.
