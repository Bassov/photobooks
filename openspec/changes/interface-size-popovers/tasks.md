## Implementation

- [ ] 1. `Popover.tsx` / `.css`: `useScaledGaps`, `overlayBox`, positioner + `.pb-overlay-box` rules; Popover uses them.
- [ ] 2. `Menu.tsx` / `.css`: MenuPopover positioner + zoomed `.pb-menu-popover__box`.
- [ ] 3. `ListSelect.tsx` / `.css`: list box, width = trigger width / s, offset × s.
- [ ] 4. `Tooltip.tsx` / `.css`: tooltip box, inset hairline, offset × s.
- [ ] 5. Unit tests for scaled gaps and the box; `e2e/interface-size-popovers.spec.ts` (IS5 at 1.25 / 1.5, 100 %
      scroll case).

## Manual test scenarios

1. 3840×2160, `photobooks.ui.scale.v1 = 150`: open the zoom menu, hover a tool, right-click a left-page frame, open
   the library sort menu, a book menu and Create book → Page size. Each sits next to its trigger with a 1.5× gap and
   1.5× size, inside the window.
2. 1440×900 at 100 %: the same popovers look as before.
