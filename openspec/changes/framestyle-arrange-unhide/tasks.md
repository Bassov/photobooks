## Implementation

- [ ] 1. Photo inspector renders Frame style and Arrange again; switch and prop removed; unit tests back to the visible order.
- [ ] 2. `FrameStyleSection` kit look: outline "New style" button with plus icon, row sliders, kit uses note, thumb swatches.
- [ ] 3. e2e specs flipped by #389 restored; `design-r14-hide-framestyle.spec.ts` asserts the visible kit values.
- [ ] 4. e2e `framestyle-arrange.spec.ts`: style edit restyles every frame using it; Send to back changes stacking; 40-spread style edit zero-LoAF gate.
- [ ] 5. Spec delta `spread-view` Inspector context header: Frame style and Arrange listed.

## Manual test scenarios

1. 1440 × 900, give all photos a white 5 mm mat via one style, change it to 3 mm: every spread updates; the inspector has no layout shift.
2. Two overlapping frames: Send to back on the top one puts it behind the other.
