## Implementation

- [ ] 1. Unit tests first: `GuidesOverlay` lists `parent.guides` for a parent id; `startGuideDrag` add / move / remove on a parent id (one undo step); `MastersCanvas` rulers only with rulers on.
- [ ] 2. `GuidesOverlay` + `guideGesture`: resolve through `editableSpread`; placed guide finds its ruler via `[data-rulers]`.
- [ ] 3. `Rulers` optional `pxPerMm`; `MastersCanvas` mounts rulers + inset area (`data-rulers`, CoverCanvas.css).
- [ ] 4. e2e `e2e/parent-spreads-guides.spec.ts`: painter ruler drag / move + undo / drop on ruler; library save + reload; frame-budget gate for a master guide drag.

## Manual test scenarios

1. Masters mode on `?fixture=painter&parent=a`, Shift+R: rulers show on the master stage; drag from the top ruler onto Master A → one guide; drag it → moves; drag onto the top ruler → removed.
