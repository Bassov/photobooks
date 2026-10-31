# fix-spread-gap-zoom

Tag: feature
Milestone: P1
Title: Bug: fix-spread-gap-zoom — gap between spreads must scale with zoom (Owner bug, 2026-10-31)

## Scope

- [ ] Owner bug: the gap between spreads jumps with zoom (smallest zoomed in, largest zoomed out, relative to the spreads). The stack gap is a fixed fraction of the spread height (kit `#/demo`: 44 px under its 588 px Fit spread at 1440×900) at every zoom; stride, windowing, zoom anchoring and the whole-book fit use it.
- [ ] Page numbers stay 6 px under the spread inside the gap and hide when the gap is too short; gap drop zones still work.
- **Done when:** `e2e/spread-gap-zoom.spec.ts` (gap / spread height constant within 2% at the floor, Fit and zoomed in; ≈ kit ratio at Fit) and `e2e/design-r2-spread-list.spec.ts` green with `--repeat-each=30`.
- **Browser check:** 1440×900 session book: Fit, zoom in, zoom out to the floor — the gap keeps its size relative to the spreads; page numbers never overlap the next spread.
- **UI kit:** `uikit/src/sandbox/viewport.tsx` (`Stack` gap 44 :271-323, fit :274). UI ref: uikit#/demo.
