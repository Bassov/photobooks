## Decisions

1. **Detector module `src/photo/heic.ts`**: `isHeicByName` / `isHeicMime` / `isHeicSignature` (ISO-BMFF `ftyp` @4 + brands `heic|heix|hevc|hevx|heim|heis|mif1|msf1`). Replace `mime.isHeicLikeFile` with `isHeicByName || isHeicMime`. One exported message constant (kit copy + iPhone Settings hint).
2. **Partition stays sync**: HEIC name/MIME → reason `heic` + constant message. Reuse `isImageLikeFile` so folder HEIC stays an error (never skipped).
3. **Sniff only unknown rejects**: In `importPhotoFilesInner`, for rejected empty/`application/octet-stream` with no image extension, one `slice(0,32)` sniff; signature → upgrade to HEIC message/reason. Decode-fail path in `processPhotoRequest` remaps error text when buffer is HEIC.
4. **Picker visibility without accept-for-decode**: `acceptedPhotoAcceptAttr` + FSA `PICKER_TYPES` add HEIC; `isAcceptedPhotoMime` still rejects. Security: FSA widen ≠ enqueue; capped reject-only sniff; worker remaps existing decode buffer only; no new decoder/deps.
5. **UI reuse**: existing import-errors chrome (toast / panel, `--destructive`); no new tokens. `ui-review` before push/archive.

## Touch-set & Test Plan

- Files: `src/photo/heic.ts` (+tests), `mime.ts`, `pickPhotos.ts`, `importPhotos.ts`, `processPhoto.ts`; `openspec/specs/photo-card`; `e2e/filmstrip.spec.ts`; roadmap ticks
- Reuse: `isImageLikeFile`, `partitionImportFiles`, import-errors list/toast, `failed-import-no-tile`
- Tests: unit + fast-check on signature (random bytes never FP without `ftyp`+brand); `pickPhotos` HEIC MIME/ext/empty/octet-stream; `processPhoto` decode+HEIC bytes → message; e2e empty/happy/interact lock-ins for HEIC message + count/tile
