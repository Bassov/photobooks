## Decisions

1. Two boxes: the element React Aria positions keeps its class + consumer `className` but is a bare unzoomed flex
   column (1 px transparent border, unlayered `width: auto`, inline `max-height`); its one child `.pb-overlay-box`
   has `zoom: var(--ui-scale)`, the same `className` and the paint (`--popover`, `--radius-md`, `--shadow-md`).
2. A zoomed 1 px border snaps to 1 screen px, so the box covers the positioner border (margin `-1px / s`, padding
   1 px); the Popover / Tooltip `--border` hairline is an inset shadow. 100 % is unchanged; at s sizes are × s.
3. `offset` / `crossOffset` / `containerPadding` × s via `useScaledGaps` (`scaledOverlay.tsx`).
4. ListSelect box width `var(--trigger-width) / s`. A long list shrinks in the flex column and scrolls.
5. `Select.tsx` (in the item scope) is a native `<select>`: nothing to change.

## Touch-set & Test Plan

| File                                         | Why                    |
| -------------------------------------------- | ---------------------- |
| `src/ui/scaledOverlay.tsx`                   | gaps hook, box wrapper |
| `src/ui/scaledOverlay.css`                   | `.pb-overlay-box`      |
| `src/ui/Popover.tsx`                         | box + gaps             |
| `src/ui/Popover.css`                         | positioner + paint     |
| `src/ui/Menu.tsx`                            | box + gaps             |
| `src/ui/Menu.css`                            | positioner + paint     |
| `src/ui/ListSelect.tsx`                      | box + gaps             |
| `src/ui/ListSelect.css`                      | positioner + width     |
| `src/ui/Tooltip.tsx`                         | box + gaps             |
| `src/ui/Tooltip.css`                         | positioner + paint     |
| `src/ui/Popover.test.tsx`                    | unit                   |
| `e2e/interface-size-popovers.spec.ts`        | IS5 e2e                |
| `docs/roadmap/P5/interface-size-popovers.md` | item stub filled       |

- Reuse: `useUiScale`, e2e fixtures `openLibraryBook` / `applyLayout`. Skill `ui-review` before push.
- Unit: gaps × s, box classes. e2e: six popovers at 1.25 / 1.5 vs 100 % (±0.5, inside, on top); 100 % menu scrolls.
  No empty state: an overlay exists only when open.
