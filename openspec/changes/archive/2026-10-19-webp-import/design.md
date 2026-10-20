# Design

## Context

- Picker already accepts WebP (`mime.ts`, `pickPhotos.ts`); failures happen in the photo worker during EXIF size parse.
- `readOrientation` already wraps exifr and defaults to 1; size parse at `processPhotoRequest` does not.
- Width/height already fall back through SOF → EXIF fields → `bitmap.width/height` once parse returns an object.

## Goals / Non-Goals

**Goals:**

- WebP (lossy + lossless) imports succeed with filmstrip thumbs and placeable previews.
- Size-parse exifr throws become soft failures (`{}`); hard decode (`createImageBitmap`) stays hard.
- Deterministic fixtures + unit/e2e proof; corrupt WebP still reports a decode error.

**Non-Goals:**

- WebP alpha / checkerboard (`transparent-preview`).
- Removing blank tiles after corrupt import (`failed-import-no-tile`).
- HEIC messaging; edits to `importPhotos.ts` / `pickPhotos.ts`; new dependencies.

## Decisions

1. **Catch only the size `exifr.parse` call** (mirror orientation). Do not broaden the outer try/catch or swallow `createImageBitmap` errors.
   - Alternative rejected: skip exifr entirely for WebP MIME — would special-case by type and miss future formats that also lack EXIF.
2. **Fixtures via a small Node writer** (`write-sample-webp.mjs`) next to `write-sample-png.mjs`, wired through `ensurePhotoFixtures`. Prefer hand-built RIFF/VP8(+L) bytes (or a tiny pure encoder) over adding `sharp`/`cwebp`.
3. **e2e on `photo-file-input`** in `filmstrip.spec.ts`. UI observables locked in: **empty** = filmstrip before import (no gallery items / no import errors); **happy** = lossy + lossless WebP → thumbs + gallery count, no `import-errors`; **interact** = place one → `spread-frame-image` with `naturalWidth > 0`; truncated WebP → import error (no blank-tile claims). Scroll = N/A (no new scrollport).
4. **Touch-set:** `readExifImageSize.ts` (+ test); `processPhoto.ts` (+ unit test / test-helpers); fixture writer + `ensurePhotoFixtures` + `.gitignore`; `filmstrip.spec.ts`; OpenSpec delta `photo-card`; roadmap item ticks/Status only (not the UI-kit line region).

## Risks / Trade-offs

- Hand-written WebP must decode in Chromium Playwright; keep dimensions small (e.g. 30×20) and verify once in e2e.
- Soft-failing size parse could hide other exifr bugs; acceptable because bitmap dimensions remain authoritative for layout when EXIF is absent.

## Security

- N/A new surface: WebP is already accepted by the picker; this change only soft-fails the size-metadata `exifr.parse` inside the existing photo worker.
- No new File System Access, blob URL, CSP, dependency, or export behavior. Hard `createImageBitmap` failures remain per-file errors.
