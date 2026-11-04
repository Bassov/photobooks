# parent-guides-prod-overhang

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item parent-guides-prod-overhang
Status: done

## Scope

- [x] Book-editor guide lines (own and parent) show their 24 px overhang past the page on all four sides at every zoom, as spec PG1 and the kit `GuideLine` (`uikit/src/sandbox/canvas.tsx`) draw them; today the pasteboard slot's paint containment (`.pasteboard-slot`, `src/editor/EditorShell.css`) clips it above the page and left / right of it
- [x] Frames, photos and other spread content stay clipped where they are clipped today (slot box: page edges, the gap below)
- [x] Every guide-line caller covered: book spreads, single first / last pages, Masters canvas
- **Browser check:** pull a vertical and a horizontal guide on a two-page spread — each line extends 24 px past the page on both ends at Fit and at a high zoom; on a Master A child spread the dashed parent guides do too; same on the Masters canvas; in crop mode on a frame at the page edge the photo ghost stays clipped at the page edge.
- **Hard nos:** no kit edits; no `src/render/**`, `src/core/parentSpreads.ts`, `src/core/resolveSpread.ts` edits; no layout shift or page-level H/V scroll
- **UI kit:** `uikit/src/sandbox/canvas.tsx` `GuideLine` (`UI ref: uikit#/demo`): guide overhang past the page on all four sides

## Done when

- e2e (DOM measurement, `getBoundingClientRect` + `elementFromPoint`): a vertical guide reaches 24 px above and below the page, a horizontal one 24 px left and right, at Fit and at a high zoom; own and parent guides; Masters canvas too
- Spread content is still clipped at the slot box (e2e computed-clip assert on the paper)
- No `uikit/` change; existing tests green; full e2e at the end
