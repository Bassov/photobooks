## Implementation

- [x] 1. Grid anchors + `hint` in the snap index (`snapIndex.test.ts`)
- [x] 2. Build grid anchors at gesture start; move snaps + pill (`frameGesture.test.ts`)
- [x] 3. Handle resize snaps + pill (`frameHandleGesture.test.ts`)
- [x] 4. e2e: grid on/hidden/Alt/snap off; 12-column drag perf (`e2e/layout-grids-snap-wire.spec.ts`)
- [x] 5. Spread-scoped snap pill (`snapHint.ts`, `SnapLabel.tsx`) so only the dragged spread shows it

## Manual test scenarios

1. Hide grid → drag does not snap to columns; Alt-drag → no `snap · column N` label; snap off → no snap lines.
