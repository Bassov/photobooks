## Implementation

- [x] 1. Unit tests first: `GuidesOverlay` lists `parent.guides` for a parent id; `startGuideDrag` add / move / remove on a parent id (one undo step); `MastersCanvas` rulers only with rulers on. (`src/editor/GuidesOverlay.test.tsx`, `src/editor/guideGesture.test.ts` "on a parent (Masters canvas)", `src/editor/MastersCanvas.test.tsx`; 55aacb07)
- [x] 2. `GuidesOverlay` + `guideGesture`: resolve through `editableSpread`; placed guide finds its ruler via `[data-rulers]`. (55aacb07)
- [x] 3. `Rulers` optional `pxPerMm`; `MastersCanvas` mounts rulers + inset area (`data-rulers`, CoverCanvas.css). (55aacb07; `useClientSize` returns the area ref)
- [x] 4. e2e `e2e/parent-spreads-guides.spec.ts`: painter ruler drag / move + undo / drop on ruler; library save + reload; frame-budget gate for a master guide drag. (4 passed; gate 0 LoAF with 40 spreads mounted)

## Manual test scenarios

1. Masters mode on `?fixture=painter&parent=a`, Shift+R: rulers show on the master stage; drag from the top ruler onto Master A → one guide; drag it → moves; drag onto the top ruler → removed.

`pnpm agent manual-qa`: problem (harness) — `start-session` click on the welcome screen intercepted by its header for 30 s; the scenario never reached the editor. Not a product result; covered by `e2e/parent-spreads-guides.spec.ts` (Shift+R rulers on the master, top-ruler create, move + undo, drop on ruler removes; all pass).
