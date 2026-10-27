## Implementation

- [x] 1. `assetsPanelModel.ts` + unit/PBT tests (rows, sort, window) — `assetsPanelModel.test.ts`
- [x] 2. `AssetsPanel.tsx` virtualized list, thumb/name/status/uses/spreads, empty state — `AssetsPanel.test.tsx`
- [x] 3. Sort control (status / uses) in a transition — `AssetsPanel.test.tsx`
- [x] 4. Jump to frame's spread (click row) — `AssetsPanel.test.tsx`
- [x] 5. Update for modified rows via `acceptModifiedAsset`, crop kept — `AssetsPanel.test.tsx`
- [x] 6. `LeftPanel` Pages | Assets tabs wired in `EditorShell` — `LeftPanel.test.tsx`
- [x] 7. e2e + 1000-asset perf scenario; spec — `e2e/assets-panel.spec.ts`

## Manual test scenarios

1. Retouch a placed photo on disk, rescan → row shows modified; Update refreshes preview, crop kept.
2. Click a row → pasteboard jumps to its frame.
3. 1000-asset book: scroll the panel, sort by status — no jank.
