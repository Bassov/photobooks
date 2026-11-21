## Implementation

- [x] 1. `overlay-scale.tsx`: `useOverlayScale`, `scaledGaps`, `zoomStyle`, `scaledBox` (zoomed single content root, inset hairline).
- [x] 2. Popover + Tooltip: unzoomed positioner, zoomed box at s ≠ 1, gaps × s; Select / JollyMenu `--trigger-width` ÷ s.
- [x] 3. DialogOverlay + ToastRegion: root `zoom: s` at s ≠ 1.
- [x] 4. `e2e/kit-interface-size.spec.ts` "IS5 kit": dialog, Select, tooltip, book menu at 125 = 100 × 1.25, anchored.

## Manual test scenarios

1. `/uikit/#/demo` 1920×1080 → Settings → Interface → 125% → New book: dialog 1.25×, Page size list under its trigger, same width.
2. Library → book "…" menu: 1.25×, right edge on the trigger.

Kit-only PR: `pnpm agent manual-qa` drives prod editor-shell, not the kit. Evidence = the e2e demo walk.

- OK 1–2: `e2e/kit-interface-size.spec.ts` "IS5 kit" walks `#/demo` 1920×1080 at 100 and 125 (dialog, Page size Select, editor tooltip, spread toast, book menu): sizes × 1.25 ±0.5, gaps × 1.25, menu right edge and Select width as at 100 %.
- OK IS10: `pnpm test:e2e:quiet e2e/kit-` 398 passed.
- ui-review: pass (existing tokens / primitives, no a11y or state change).
