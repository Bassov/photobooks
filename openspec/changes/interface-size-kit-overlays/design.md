## Decisions

1. **Scale:** `useOverlayScale()` = kit `UiScaleCtx / 100` (session choice, D4 clamp); context crosses portals; outside a stage it is 1. At s = 1 every overlay keeps its old DOM and classes (IS10).
2. **Positioned overlays** (Popover, Menu / Select via Popover, Tooltip): at s ≠ 1 the React Aria element is a bare flex positioner; its single child gets `zoom: s`, `--overlay-scale`, the box and the consumer's classes. `offset` / `crossOffset` / `containerPadding` × s (prod `useScaledGaps`).
3. **Hairline:** a zoomed 1 px border snaps, so the box draws `inset-ring-border` inside `p-px`.
4. **Widths:** `--trigger-width` is screen px; Select / JollyMenu divide it by `var(--overlay-scale, 1)`.
5. **Modal roots:** `DialogOverlay` and `ToastRegion` get `zoom: s`.
6. Tokens / primitives: existing `--popover`, `--border`, kit Popover / Tooltip / Dialog / Toast; none added to `docs/design.md`.

## Touch-set & Test Plan

| File                                        |
| ------------------------------------------- |
| `uikit/src/components/ui/overlay-scale.tsx` |
| `uikit/src/components/ui/popover.tsx`       |
| `uikit/src/components/ui/tooltip.tsx`       |
| `uikit/src/components/ui/select.tsx`        |
| `uikit/src/components/ui/menu.tsx`          |
| `uikit/src/components/ui/dialog.tsx`        |
| `uikit/src/components/ui/toast.tsx`         |
| `e2e/kit-interface-size.spec.ts`            |

- Reuse: prod `src/ui/scaledOverlay.tsx` pattern.
- e2e: `#/demo` 1920×1080 walk at 100 and 125 — dialog, Select, tooltip, book menu sizes, gaps, right edge; a library toast at 125 = 100 × 1.25. IS10: existing kit e2e + baselines. No kit unit tests exist.
