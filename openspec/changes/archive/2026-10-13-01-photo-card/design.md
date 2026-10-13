# Design

## Context

Branded shell only (`src/App.tsx`). LoAF helpers live in `src/perf/loafObserver.ts` but start only in DEV (`src/main.tsx`); e2e uses preview builds. No EXIF libs, workers, or file pickers yet. See proposal.md for motivation; see delta `photo-card` spec for behavior.

## Goals / Non-Goals

**Goals:**

- One open-photo path shared by FSA picker and `<input type="file">`.
- Pure helpers + worker decode so LoAF ≤ 200 ms on large JPEG import.
- Test surface that kills orientation/formatBytes mutants and covers e2e via input fallback.

**Non-Goals:**

- Persisted library, `book.json`, multi-select, editing tools.

## Decisions

1. **Modules under `src/photo/`**
   - Pure: `normalizeOrientation`, `aspectRatio`, `formatBytes`, MIME gate, `loadPhoto` orchestration types.
   - Worker: EXIF via `exifr` + Zod at boundary; `createImageBitmap` / OffscreenCanvas for downscaled preview; post result model + preview blob URL transfer plan (transferable or object URL created on main from transferred bytes).
   - UI: CTA + hidden input + card/error in App (or thin `PhotoCard` component); keep existing brand shell.
   - Alternatives: parse EXIF only on main — rejected (LoAF risk on 24MP).

2. **Deps:** `exifr` + `zod`. Alternatives: hand-rolled Orientation IFD — higher bug risk for little gain.

3. **Picker:** `showOpenFilePicker` when present; always mount hidden input (`accept` JPEG/PNG/WebP, `data-testid="photo-file-input"`) for Playwright `setInputFiles`.

4. **LoAF in e2e:** Start observer and expose `window.__photobooksPerf` (`clear`, `assertNoExcessiveBlocking`) when `?loaf=1` (and keep DEV). Scenario opens `/?loaf=1`, imports fixture, asserts budget.

5. **Fixtures:** Small EXIF JPEG committed under `e2e/fixtures/`; generate ~24MP JPEG via `e2e/fixtures/generate-large-jpeg.mjs` (gitignored binary or script-produced before e2e).

6. **Supported MIME:** `image/jpeg`, `image/png`, `image/webp` only.

## Risks / Trade-offs

- [FSA missing in Firefox/WebKit] → input fallback always available.
- [Worker + e2e preview] → Vite worker import must work in production build used by Playwright.
- [24MP fixture size] → generate in script; do not commit multi‑MB binary if avoidable.
- [createImageBitmap orientation] → still apply `normalizeOrientation` for metadata dimensions; preview transform from EXIF map.

## Migration Plan

Greenfield feature on empty shell; no data migration. Rollback = revert PR.
