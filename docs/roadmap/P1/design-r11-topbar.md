# design-r11-topbar

Tag: feature
Milestone: P1
Title: Bug: design-r11-topbar: editor top bar controls match the kit
Status: done

## Scope

- [ ] M69: editor top bar controls match kit `#/demo` at 1440 × 900 (step `editor-spread-1`). Panel toggles: ON bg rgb(215, 215, 215) (kept on hover), colour rgb(83, 81, 82) on and off, padding 0, OFF hover rgba(57, 55, 56, 0.08). Preview: full pill, padding 0 12, 96 wide, bg 215 kept on hover. Settings: 40 × 32 pill, bg 215, colour rgb(57, 55, 56). Undo/Redo: 32 × 32, flush. Zoom menu: padding 0 8, no min width (49 at "Fit"), hover bg rgb(207, 207, 207) / rgb(57, 55, 56). Preview → Settings gap 6.
- [ ] Top bar row height (48), title position, the centred tool group and the M37 / M49 / M51 zoom behaviour stay as now; every top-bar item's x matches the kit within 0.5 px (left cluster absolute; right cluster relative to its neighbours, the kit's Print / Publish are out of scope).
- **Done when:** `e2e/design-r11-topbar.spec.ts` green with `--repeat-each=30`; r4 top bar, r7 canvas-chrome and r10 specs stay green; full chromium e2e suite and the perf spec green.
- **Browser check:** 1440 × 900: open a book, select spread 1; read the toggles on, hide the photos panel and read it off, hover each control. Values equal kit step `editor-spread-1`.
- **UI kit:** `uikit/src/sandbox/chrome.tsx` (`TopBar` :143, `PanelToggles` :207, `ZoomMenu` :123, `HistoryButtons` :96), `uikit/src/demo-parts/editor.tsx` (`EditorTopBar` :90). UI ref: `uikit#/demo`.
- **Source:** Owner rule: every Designer item is a Must; round 11, Designer review r10 2026-11-01 (M69).
