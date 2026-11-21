## Implementation

- [x] 1. `overlay-scale.tsx`: `useOverlayScale`, `scaledGaps`, `zoomStyle`, `scaledBox` (zoomed single content root, inset hairline).
- [x] 2. Popover + Tooltip: unzoomed positioner, zoomed box at s ≠ 1, gaps × s; Select / JollyMenu `--trigger-width` ÷ s.
- [x] 3. DialogOverlay + ToastRegion: root `zoom: s` at s ≠ 1.
- [x] 4. `e2e/kit-interface-size.spec.ts` "IS5 kit": dialog, Select, tooltip, book menu at 125 = 100 × 1.25, anchored.

## Manual test scenarios

1. `/uikit/#/demo` 1920×1080 → Settings → Interface → 125% → New book: dialog 1.25×, Page size list under its trigger, same width.
2. Library → book "…" menu: 1.25×, right edge on the trigger.
