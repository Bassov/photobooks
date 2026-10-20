# missing-assets-relink

Tag: feature
Milestone: M2.5
Title: moved photo folders
Status: done

## Scope

- [x] Missing-assets view (missing and modified); relink by rescanning a folder and matching hashes (scan and hashing in the worker)
- **Perf:** rescan progress batched per frame. Gate: scroll the filmstrip while a rescan runs — zero LoAF.
- **Browser check:** rename/move the photo folder, reopen, relink in one step, all photos restored; the UI stays responsive during the rescan.
- **UI ref:** `uikit#/feature/missing-assets-relink`
- **UI kit:** `uikit/src/features/m2.tsx:253-261` (`missing-assets-relink` demo + notes), `UI ref: uikit#/feature/missing-assets-relink` — missing/modified relink dialog + hatched frames, `uikit/src/features/screens.tsx` (RelinkDialog)
