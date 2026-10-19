# Proposal

## Why

- WebP is already accepted by the picker (`image/webp` / `.webp`), but import fails with `Unknown file format` when `exifr.parse` throws on the size-metadata pass inside `processPhotoRequest`.
- Orientation already catches exifr failures and falls back; size parse does not, so the outer catch aborts before `createImageBitmap`.
- Why now: M2.2 PRODUCT item (#41); users cannot place common WebP phone exports.

## What Changes

- Guard the EXIF size-parse the same way as orientation: on failure use `{}` and let width/height fall back to JPEG SOF then `bitmap.width/height`.
- Add deterministic lossy + lossless WebP fixtures (and a truncated corrupt WebP for decode-error assertion).
- Unit + e2e coverage: WebP imports succeed with thumbnails; corrupt WebP still surfaces a decode error; `createImageBitmap` rejection still fails the job.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `photo-card`: require successful WebP import when EXIF size metadata is unavailable/unparseable, with bitmap (or SOF) dimensions; keep hard decode failures as per-file errors.

## Impact

- `src/photo/processPhoto.ts` (+ unit tests); e2e fixtures + `e2e/filmstrip.spec.ts`.
- Out of scope: WebP transparency (`transparent-preview`); blank tiles after corrupt import (`failed-import-no-tile`); HEIC (`heic-unsupported-message`); no edits to `importPhotos.ts` / `pickPhotos.ts`; no dependency changes.

## Success criteria

- e2e: lossy + lossless WebP via `photo-file-input` → thumbnails, gallery count includes both, no `import-errors`, one placed frame shows `spread-frame-image` with `naturalWidth > 0`; that regression fails on main with `Unknown file format` and passes on this branch.
- Unit: exifr size-parse throw → `ok: true` with bitmap dimensions; `createImageBitmap` reject → `ok: false`.
- Existing mime/accept tests keep `image/webp` / `.webp`.
- **Browser check:** Add photos with lossy + lossless `.webp` on preview → filmstrip thumbs + counter, no error, place one → photo on page.
- **Perf:** decode stays in the photo worker; bulk-import frame-budget scenario stays green.
- Patch coverage ≥ 85%; Stryker diff ≥ 85 with zero NoCoverage; no gate weakened.

## Risks

- N/A security (local files already accepted as WebP).
- Corrupt WebP remains a per-file decode error (asserted only; tile cleanup owned elsewhere).
