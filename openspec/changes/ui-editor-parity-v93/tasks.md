## Implementation

- [x] 1. Tone-only `#CACACA` selection for filmstrip / template strip / spreads; no black ring-select on chrome thumbs; canvas frame outline stays `--select` (`Filmstrip.css`, `SegmentedControl.css`, `--sel` token)
- [x] 2. Space = pan only: panel hotkeys ignored while Space held; `data-panning` suppresses canvas/frame focus ring while panning (`editorChromeTokens`, existing `installEditorChromeKeys`)
- [x] 3. Plain wheel zooms pasteboard to pointer; grab cursor while panning (`usePasteboardCamera`, chrome CSS)
- [x] 4. Remove Replace button/picker path; place/replace via filmstrip drag only; used-photo badges black (`dropTargets`, `frameSelection`, `ConnectedSpreadView`, e2e drag-place/swap)
- [x] 5. Folder import / filmstrip folder messages → status line only (not toasts); update `docs/design.md` hard-nos row
- [x] 6. Unit + e2e/smoke updates for hard-nos; keep library/create/open/import/place/crop/back green (`pnpm check:fast` green)

## Manual test scenarios

1. Open book → filmstrip select is gray tone only (no blue / black ring on thumb); spread list selected `#CACACA`
2. Drag filmstrip photo onto empty frame (place) and onto filled frame (replace); no Replace control visible; Crop stays on existing pasteboard path (no floating Replace/Crop toolbar)
3. Hold Space → pan pasteboard; `[` / `]` / `i` do not toggle panels; canvas has no focus ring while `data-panning`
4. Wheel over pasteboard zooms to pointer; no page-level scroll
5. Import folder → status line updates; no folder-progress toast; Preview/Print/Publish stay quiet

OK: e2e drag-place/swap + Space/wheel camera unit proofs; hard-no CSS/token unit locks; `assertDocumentFitsViewport` on place flows.
problem: `pnpm agent manual-qa` could not open editor from Welcome (`start-session` intercept) — covered by existing e2e `openSessionEditor` paths instead.
ui-review: PASS — tokens (`--sel`, chrome CSS); focus rings gray; no blue chrome; empty/happy/scroll locked in e2e; Theme B density.
