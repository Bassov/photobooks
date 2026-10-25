## Decisions

1. **Root cause:** `importScannedEntriesInBatches` calls `importPhotoFiles` per 16-file wave; each wave’s `finally` clears `importRunning` while remaining list-first identity placeholders still lack session Files. `detectMissingAssets` / auto-detect then open Missing/Rescan and the pill; the list shrinks as later waves `retainAssetSource`.
2. **Fix:** Batch driver owns the flag for the whole scan+import. Add `manageImportRunning` (default `true`) on `importPhotoFiles` / `runChromeImport`; multi-batch path sets `importRunning` once, passes `manageImportRunning: false`, clears in its own `finally`. Keep existing detect/autoDetect `importRunning` early-return.
3. **Not chosen:** Dual-gate on `importProgress` alone (progress can lag flag; would need a new subscription). Nesting counters (enqueue + per-batch would stick true).

## Touch-set & Test Plan

- Files: `importPhotos.ts`, `runChromeImport.ts`, `photoRootSession.ts` (`importScannedEntriesInBatches`); tests under `folderImportBatches` / `relink`; `openspec/specs/editor-shell` delta.
- Reuse: existing `setImportRunning` + detect gate.
- Tests: unit — `importRunning` stays true across mocked multi-batch boundaries; detect still skips while running and opens when idle with unsourced identity assets. No new e2e (existing filmstrip/open-save cover idle missing); UI chrome unchanged (no new tokens). Stage 9: skill `ui-review` N/A for visual chrome (gating-only); `manual-qa` covers import progress vs Missing dialog.
