## Decisions

1. **Error model:** `ImportFileError` gains stable `id`, `reason` (`unsupported-type` | `heic` | `decode-failed`), optional `assetId`. MIME reject → `heic` when name/MIME is HEIC/HEIF else `unsupported-type`; batch catch → `decode-failed` + `assetId`. Message/signature sniff stays later items.
2. **Store:** `importErrorsStore` — append/dismiss/clear + immutable `useSyncExternalStore` snapshots. Imports append (drop wipe in `runChromeImport`). Group-by-reason once per mutation, not per render.
3. **Panel:** extract `ImportErrorsPanel` (Dialog + Button; collapsible groups). Open from toast "Show files" and filmstrip status. Lazy when open. Tokens: overlays `#c-overlays`, Status/`--destructive` chrome — not toast chrome.
4. **Jump:** gallery `assetId` → filmstrip scroll + `setSelectedAssetId` + brief highlight; else "Not imported".
5. **a11y / perf / security:** polite Status once on append; labelled dismiss; focus back to opener. Zero LoAF on import-with-failures; open ≤200 errors under handler budget. No FSA/decode surface change.
6. **Extract over bang growth:** thin wiring in TopBar/FilmstripStatus; do not enlarge bang-excluded shells.

## Touch-set & Test Plan

- Files: `src/photo/{assetPool,pickPhotos,mime}`, `src/editor/{importErrorsStore,ImportErrorsPanel,importErrorToast,runChromeImport,importPhotos,importHashReuse,Filmstrip,FilmstripStatus,EditorTopBar}`, CSS/`docs/design.md`/uikit specimen as needed, roadmap, unit + `e2e/filmstrip.spec.ts`
- Reuse: `src/ui/{Dialog,Button,Status,Toast}`, toast queue, filmstrip prefix scroll, `setSelectedAssetId`
- Tests: store + reason mapping unit; component public props; e2e 2 unsupported + 1 corrupt + valid → panel counts, dismiss, Clear all, jump. Manual + ui-review.
