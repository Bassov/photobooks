## Implementation

- [ ] 1. M43: selection and crop `::after` yield to the drop chip on a drop target; the chip takes the kit `text-2xs` line height.
- [ ] 2. M44: the Library link gets the kit 6 px / 10 px padding and 4 px gap, not overridden by `.pb-button`.
- [ ] 3. `e2e/design-r5-polish.spec.ts` asserts the kit values; unit style test updated.

## Manual test scenarios

1. 1440×900: drop a photo, click it, press and drag 60 px left: the dimmed photo stays whole, chip centred at the top; Escape + release restore it.
2. Editor top bar: "‹ Library" chevron at x 18, label at x 38.
