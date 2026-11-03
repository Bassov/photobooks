# design-r16-kit-book

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item design-r16-kit-book
Status: done

## Scope

- [ ] M89: the `#/demo` endpaper canvas caption "Endpaper" sits 8 px under the endpaper bottom (12 px), as prod `.endpaper-caption` (`src/editor/EndpaperCanvas.css`, margin-top 0.5rem); the cover / master labels keep 10 px
- [ ] M90: the cover inspector front thumbnail keeps prod's 42 × 52 (`.cover-thumb`, flex none) instead of shrinking to 38.45, so "No photo yet" / "Drag a photo…" start 12 px right of it (x 1210 at 1440)
- [ ] M91: the endpaper spine is prod's 1 px hard line at the centre, `color-mix(in srgb, black 18%, transparent)` (`.endpaper-gutter`), instead of the 8 % gradient `.07/.14/.07`; master spreads keep the gradient
- **Browser check:** `uikit#/demo` editor at 1440 × 900: endpaper selected → caption 8 px under the spread, a 1 px dark line at the spine; cover selected → front thumb 42 × 52, its copy at x 1210.
- **Test:** kit `uikit/scripts/qa.mjs` kit-sync W4 block appends one assertion per number (caption dy / font size, spine width / colour / centre, thumb w / h, copy x)
- **Hard nos:** kit-only (`uikit/`); no `src/` change; `uikit/src/sandbox/chrome.tsx` and `context-inspector.tsx` untouched; qa script only appended
- **UI kit:** `uikit/src/sandbox/v7.tsx` (`EndpaperSpread`, cover inspector), `uikit/src/sandbox/viewport.tsx` (`PageLabels`); `UI ref: uikit#/demo`; Designer parity r15 M89–M91 (`photobooks-orch/shared/design/r15/review.md`), tracker W4 kit-pending
