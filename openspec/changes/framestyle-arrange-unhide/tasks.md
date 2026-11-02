## Implementation

- [x] 1. Photo inspector renders Frame style and Arrange again; switch and prop removed; unit tests back to the visible order.
- [x] 2. `FrameStyleSection` kit look: outline "New style" button with plus icon, row sliders, kit uses note, thumb swatches.
- [x] 3. e2e specs flipped by #389 restored; `design-r14-hide-framestyle.spec.ts` asserts the visible kit values.
- [x] 4. e2e `framestyle-arrange.spec.ts`: style edit restyles every frame using it; Send to back changes stacking; 40-spread style edit zero-LoAF gate.
- [x] 5. Spec delta `spread-view` Inspector context header: Frame style and Arrange listed.

## Manual test scenarios

1. 1440 × 900, give all photos a white 5 mm mat via one style, change it to 3 mm: every spread updates; the inspector has no layout shift.
2. Two overlapping frames: Send to back on the top one puts it behind the other.

- 1: problem (harness): `pnpm agent manual-qa` timed out on `start-session` (click intercepted by the welcome header) before the scenario ran. Covered by e2e `framestyle-arrange.spec.ts` "a style edit restyles every frame that uses it" (3 mm ↔ 5 mm on 3 frames) and `design-r14-hide-framestyle.spec.ts` "every section open … no layout shift".
- 2: problem (harness): same `start-session` blocker. Covered by e2e `framestyle-arrange.spec.ts` "Send to back puts the top frame behind the one it overlaps" (`elementFromPoint` stacking).
