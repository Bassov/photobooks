# parent-guides-kit

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item parent-guides-kit
Status: done

## Scope

- [ ] Kit `GuideLine` (Designer parent-guides Spec PG5): inherited (parent) guides are `passive` → `pointer-events-none` unless `features.parentEdit` (`SpreadSurface` passes the prop); dash colour `var(--parent-soft)` instead of the literal `#a3a1a2`; overhang 24 px past the page for every guide (Designer decision: as prod)
- [ ] Kit `viewport.tsx`: drop the inherited-guide status branch (Designer decision: parent guides let clicks through, no status); the parentEdit edit path stays
- [ ] `demo-capture.mjs`: step `editor-parent-guides-inherited` right after `editor-master-guides-edit` (switch to Pages); guide-showing baselines regenerated
- **Done when:** kit `#/demo`: on a Master A child spread the master guides show dashed 1 px #a3a1a2 under own guides, extend 24 px past the page (DOM), a click on one reaches the frame below (DOM: `elementFromPoint` = frame); kit qa green; baselines updated
- **Browser check:** `uikit#/demo` editor: Masters → drag a guide from the ruler onto Master A → Pages: spread 2–3 shows the master guides dashed; click where a master guide crosses a frame → the frame is selected, no status text
- **Test:** kit `uikit/scripts/qa.mjs` parent-guides block (colour, overhang, pointer-events, elementFromPoint, DOM order, no status); demo baseline for the new step
- **Perf:** N/A (class changes only)
- **Hard nos:** kit only, no prod `src/`; not `chrome.tsx` ThumbGrid, presentation overlay files, `uikit/src/features/site-*`
- **UI kit:** `uikit/src/sandbox/canvas.tsx`, `uikit/src/sandbox/viewport.tsx`, `uikit/scripts/demo-capture.mjs`; `UI ref: uikit#/demo`; Designer spec `photobooks-orch/shared/design/parent-guides/spec.md` (PG5)
