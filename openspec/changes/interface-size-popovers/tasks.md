## Implementation

- [x] 1. `scaledOverlay.tsx` / `.css` (`useScaledGaps`, `overlayBox`, `.pb-overlay-box`); `Popover.tsx` / `.css` use
      them (positioner + `.pb-popover__box`). Evidence: `src/ui/Popover.test.tsx` "positioned overlays at interface
      scale".
- [x] 2. `Menu.tsx` / `.css`: MenuPopover positioner + zoomed `.pb-menu-popover__box`. Evidence: same suite (menu
      classes), e2e zoom / sort / book / frame menus.
- [x] 3. `ListSelect.tsx` / `.css`: list box, width = trigger width / s, offset × s. Evidence: unit "list select",
      e2e Page size list.
- [x] 4. `Tooltip.tsx` / `.css`: tooltip box, inset hairline, offset × s. Evidence: unit "tooltip", e2e tool tooltip.
- [x] 5. Unit tests for scaled gaps and the box; `e2e/interface-size-popovers.spec.ts` (IS5 at 1.25 / 1.5, 100 %
      scroll case): 5 passed.

## Manual test scenarios

1. 3840×2160, `photobooks.ui.scale.v1 = 150`: open the zoom menu, hover a tool, right-click a left-page frame, open
   the library sort menu, a book menu and Create book → Page size. Each sits next to its trigger with a 1.5× gap and
   1.5× size, inside the window.
2. 1440×900 at 100 %: the same popovers look as before.

- manual-qa 1: problem (harness entry, not reached): welcome header intercepts the start-session click. Covered by
  `e2e/interface-size-popovers.spec.ts` (s = 1.25 / 1.5, 4 tests passed).
- manual-qa 2: problem (harness entry, not reached), same cause. Covered by the untouched 100 % specs
  (`design-r12-surfaces`, `design-r13-polish`, `arrange-lock`, `parent-overrides`, `kit-frame-menu`,
  `kit-filmstrip`: 40 passed) and the 100 % scroll case in the new spec.
