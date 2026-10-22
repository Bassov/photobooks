## Implementation

- [x] 1. Paint move-source / focus ring above frame content (not inset outline under the image; CSS px, not zoom-scaled). (`SpreadView.css` / `spreadChromeStyles.ts`)
- [x] 2. Regression: Playwright — at stack-fit (~13%) and physical (~100%), move-active vs cancelled frame screenshots differ (ring paint). (`e2e/drag-swap.spec.ts`)

## Manual test scenarios

1. Place two photos; Enter on a filled frame → “Cancel move” ring clearly visible at ~13%, ~50%, ~67%, and ~100% zoom.
2. Escape clears the ring; focus-visible ring still shows on keyboard focus.
3. Swap via another frame still works; no page-level scroll.

OK Place two photos; Enter on a filled frame → “Cancel move” ring clearly visible at ~13%, ~50%, ~67%, and ~100% zoom.
OK Escape clears the ring; focus-visible ring still shows on keyboard focus.
OK Swap via another frame still works; no page-level scroll.
