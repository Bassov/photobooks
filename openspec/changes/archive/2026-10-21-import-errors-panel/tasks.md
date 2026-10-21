## Implementation

- [x] 1. Extend `ImportFileError` with `id`, `reason`, optional `assetId`; set reasons at partition / decode catch (HEIC name/MIME → `heic`)
- [x] 2. Add `importErrorsStore` (append/dismiss/clear + stable snapshots + group-by-reason once per mutation)
- [x] 3. Wire import path to append (no wipe); toast "Show files" + filmstrip status open panel; polite Status announce
- [x] 4. Build `ImportErrorsPanel` (Dialog/groups/dismiss/Clear all); jump-to-tile scroll + select + highlight
- [x] 5. Unit + e2e (grouped counts, dismiss, clear, jump); update filmstrip selectors; roadmap ticks
- [x] 6. Manual QA (`pnpm agent manual-qa`) + ui-review; kit/?specimen grouped panel note

## Manual test scenarios

1. OK Import a folder with several broken and unsupported files: toast "Show files" opens a panel grouped by reason with counts; filmstrip status also opens it.
2. OK Dismiss one entry, then Clear all; polite Status announces new errors once; dismiss buttons labelled; focus returns to trigger on close.
3. OK An entry for a photo still in the gallery scrolls the filmstrip to it, selects it, and briefly highlights; keyboard-only works with visible focus; no page-level H/V scroll.

### ui-review

- Design system / a11y / layout smoke: pass — Dialog + Button + Status/`--destructive` on tokens; labelled dismiss; polite Status; e2e groups/dismiss/clear/jump green. Anti-slop N/A (editor chrome).
