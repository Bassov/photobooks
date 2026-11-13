## Implementation

- [x] 1. e2e K2 `#/demo: Publish hovers like Preview, idle box unchanged` in `e2e/kit-in-app-publish.spec.ts` (red before the fix: hovered Publish ≈ 206 vs Preview 215).
- [x] 2. Drop `e7-sec` from the Publish pill in `uikit/src/demo-parts/editor.tsx` (spec 15/15 green).

## Manual test scenarios

1. Kit `#/demo` editor: hover Publish, then Preview — same light grey; idle Publish size unchanged.
   - OK (Playwright, kit-only: agent manual-qa drives prod editor-shell, not the kit) — K2 `#/demo: Publish hovers like Preview, idle box unchanged`: hovered Publish = hovered Preview = rgb(215) at (6, 16) of a clipped screenshot; idle 73.58×32, padding 0 14. `pnpm uikit:qa:quick`: 422 passed, 0 failed, 0 console errors.
   - ui-review: no findings; `e7-sec` only carried the hover rule, focus / disabled / running states keep the shared `SiteJobPill` styles.
