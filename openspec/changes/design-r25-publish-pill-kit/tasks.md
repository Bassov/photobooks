## Implementation

- [x] 1. e2e K2 `#/demo: Publish hovers like Preview, idle box unchanged` in `e2e/kit-in-app-publish.spec.ts` (red before the fix: hovered Publish ≈ 206 vs Preview 215).
- [x] 2. Drop `e7-sec` from the Publish pill in `uikit/src/demo-parts/editor.tsx` (spec 15/15 green).

## Manual test scenarios

1. Kit `#/demo` editor: hover Publish, then Preview — same light grey; idle Publish size unchanged.
