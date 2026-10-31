# design-r3-canvas-fit

Tag: feature
Milestone: P1
Title: Bug: design-r3-canvas-fit: canvas Fit on spread change + click on a selected frame
Status: done

## Scope

- [x] M9 (step 14): Fit follows the active spread — at Fit, page 1, spread 2–3 and the last page each lie inside the pasteboard and the label reads "Fit" (kit `viewport.tsx` fits the two-page spread width `SW` for every spread, so Fit is one zoom per book); a manual zoom is kept on a spread change and the label shows the percent.
- [x] M3/M4 (step 16): a pointer click on the selected frame keeps it selected (Photo inspector, 8 handles); deselect only with Escape or a click on the empty pasteboard. Drag-to-swap and double-click crop unchanged; keyboard Enter on the move source keeps "Cancel move".
- **Done when:** `e2e/design-r3-canvas-fit.spec.ts` green with `--repeat-each=30`; full chromium e2e suite green.
- **Browser check:** 1440×900 new book at Fit: click page 1 → 2–3 → last page in Pages, each fitted with "Fit"; drop a photo, click the same frame twice: still selected with handles.
- **UI kit:** `uikit/src/sandbox/viewport.tsx` (Fit `SW` :124), `uikit/src/sandbox/canvas.tsx` (`onFrameDown` :280-298). UI ref: `uikit#/demo` steps 14–16.
- **Source:** Designer round 3, 2026-10-31 (NOT PASS on prod 6300717).
