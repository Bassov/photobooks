## Decisions

1. **JPEG head pass (≤64KiB):** After list-first enqueue, capped parallel heads (reuse `IMPORT_BODY_READ_CAP` + yields) extract IFD1 thumb (`exifr.thumbnail`) as a temporary filmstrip object URL until thumb320 replaces it, and SOF/EXIF dims/orientation (`readJpegSofSize` / `readExifImageSize`) into sessionMeta + folder manifest. Absent/corrupt thumb → grey placeholder. Skip when dims or hot thumb320 already exist.
2. **UI chrome:** Reuse Theme B filmstrip tokens (`--chrome`, `--thumb`, `--border`) and existing `.filmstrip-placeholder` / thumb `<img>`; no new tokens; ThumbGrid/PhotoThumb alignment deferred; no skeletons/cosmetics.
3. **Lazy HEIC (no libheif):** Accept HEIC/HEIF as gallery placeholders. No prefetch/background decode off-screen; when filmstrip-visible ∪ book-used, enqueue at `visible`. HEIC decode failure keeps the tile. Temp EXIF thumbs are session-only (not DerivedCache presets).
4. **Security:** Head buffers discarded after parse; manifest metadata only.

## Touch-set & Test Plan

- Files: `src/photo/` (exif-thumb + lazy-HEIC gate), import head-pass, `thumbCache`/`FilmstripItem`, `pickPhotos` + photo-card; specs asset-source/filmstrip/image-tiers/photo-card/derived-cache.
- Reuse: jpegSof, readExifImageSize, exifr.thumbnail, body-read cap, manifest patch, visible-id sets, setThumbUrl.
- Tests: unit — thumb present/absent/corrupt; header dims; HEIC off-screen unqueued / visible∪placed queued. e2e — empty (grey/no-EXIF), happy (EXIF→320), scroll (filmstrip promotes HEIC); skill `ui-review` before finish. PR before/after: time-to-first-non-grey; off-screen HEIC queue = 0.
