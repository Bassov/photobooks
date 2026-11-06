# kit-preview-fold-strip

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item kit-preview-fold-strip

## Scope

Designer note (page-numbers kit review, 2026-11-06): in the kit `#/demo` Preview, slide 1 (Page 1, the right page of spread 0) shows a grey strip at the page's left edge: the spread's centre fold hairline (`MiniSpread` `left-1/2 w-px bg-black/10`) left at the edge of the right-page-only clip. Kit only (`uikit/`); `src/editor/**`, `uikit/src/sandbox/v7.tsx`, `uikit/scripts/qa.mjs` are off limits.

- [x] `uikit/src/sandbox/chrome.tsx` `MiniSpread`: a `page` prop ("l" | "r") clips the spread to that page and drops the centre fold; two-page spreads keep it.
- [x] `uikit/src/features/site-viewer.tsx`: the first slide passes `page="r"`, the last slide `page="l"` (stage and lightbox).
- [x] `e2e/kit-preview-fold-strip.spec.ts`: paint probe of the Preview page edges and a two-page fold.
- **Browser check:** `#/demo` editor → Preview → →: Page 1's left edge is paper white; → again: Pages 2–3 keep the centre hairline.

## Done when

- Paint probe in `#/demo` Preview: slide 1's pixel columns 0–4 px inside the page are the paper colour (stage and lightbox); the last (left-page-only) slide's right edge columns 0–4 px match the page 8 px inside (no strip; a new book's last page is an empty placeholder frame); a two-page slide still paints the centre fold.
- Kit e2e green; other demo steps unchanged (spread-list thumbnails keep their current look).
