# design-r17

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item design-r17
Status: done

## Scope

- [ ] M92 (kit): a press released under 3 px on the `#/demo` grey canvas activates the spread whose paper is nearest (Designer decision #421, as prod): the spread list selects its row, the inspector shows "Spread · Page N", and the canvas keeps its scroll (no re-centre); today `onGrayDown` only sets the current spread and the shell's empty-canvas handler clears the node ("Select a spread or photo", no row, re-centre)
- [ ] M93 (prod): the spread-list card centre line (`.spread-page-cut`, thumbnail mode) is the kit MiniSpread hairline, 1 px `rgb(0 0 0 / .10)` (`chrome.tsx` `bg-black/10`), instead of `color-mix(foreground 28%)`; the canvas fold (`.spread-fold`) and the endpaper rows (M91) stay unchanged
- **Done when:** kit `#/demo` 1440 × 900, step `editor-spread-selected` (Esc twice, press the canvas at 20,20): row "1" selected, inspector "Spread · Page 1", page-1 label y stays 66.25 (±0.5); prod spread-list card centre line computed colour `rgba(0, 0, 0, 0.1)`, canvas fold background unchanged
- **Browser check:** `uikit#/demo` editor at 1440 × 900: open spread 2–3, select a frame, Esc twice, press the grey canvas top-left → page 1 active in list + inspector, no scroll jump; prod editor: spread-list card centre line is a faint 10 % black hairline
- **Test:** kit `uikit/scripts/qa.mjs` appends an r16 M92 block (row key, inspector title, label y before/after); prod e2e asserts the list card cut and the canvas fold computed colours
- **Perf:** no hot-path change (one CSS colour; a kit press handler)
- **Hard nos:** no `src/editor/Inspector*`, `MultiSections.tsx`, `FrameSections.tsx`, `src/ui/IconButton*`, `uikit/src/sandbox/inspector.tsx`, `context-inspector.tsx`, `styles/app.css`, `styles/tokens.css`; endpaper rows untouched
- **UI kit:** `uikit/src/sandbox/canvas.tsx` (`onGrayDown`), `uikit/src/sandbox/viewport.tsx` (Stack re-centre); `UI ref: uikit#/demo`; Designer parity r16 M92–M93 (`photobooks-orch/shared/design/r16/review.md`)
