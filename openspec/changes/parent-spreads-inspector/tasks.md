## Implementation

- [ ] 1. Core grid chain book → master → spread, `'master'` source, cache keyed on the parent grid; PBT vs `resolveParentGrid` (≥1000 runs)
- [ ] 2. `GridOverlay` per-spread snapshot through `editableSpread`, `variant="master"`; `MastersCanvas` master overlay, label, empty-click deselect
- [ ] 3. `MasterSection` (head, GRID fields, link) + `parentUsage` + link glyphs; unit tests
- [ ] 4. Inspector Masters routing (master / Photo / no-masters hint), photo sections resolve parent frames; Inspector + GridSection tests
- [ ] 5. Kit v7.tsx (Background removed, Field focus ring) + demo baselines 21–22
- [ ] 6. e2e `parent-spreads-inspector.spec.ts` (browser check, rects, MS7, no page scroll, 40-spread perf gate); update `parent-spreads-edit.spec.ts`

## Manual test scenarios

1. Masters mode, Master A: set C = 5 → master canvas shows 5 columns per page; switch to Pages with Grid on → every Master A spread shows 5 columns, a None spread keeps the book grid.
2. Click the master logo → Photo inspector; Esc → master inspector again.
3. Margins link: on → type T = 20 → T/B/I/O all 20; Undo restores all four in one step.
