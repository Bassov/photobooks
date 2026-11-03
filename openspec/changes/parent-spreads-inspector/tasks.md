## Implementation

- [x] 1. Core grid chain book → master → spread, `'master'` source, cache keyed on the parent grid; PBT vs `resolveParentGrid` (≥1000 runs) — `src/core/grid/layoutGrid.test.ts` "master (parent) level"
- [x] 2. `GridOverlay` per-spread snapshot through `editableSpread`, `variant="master"`; `MastersCanvas` master overlay, label, empty-click deselect — `GridOverlay.test.tsx` "masters", `MastersCanvas.test.tsx`
- [x] 3. `MasterSection` (head, GRID fields, link) + `parentUsage` + link glyphs; undo snapshot keeps parents — `MasterSection.test.tsx`, `inspectorModel.test.ts`, `bookStore.test.ts` "undo / redo restore the parents"
- [x] 4. Inspector Masters routing (master / Photo / no-masters hint), photo sections resolve parent frames — `Inspector.test.tsx`, `GridSection.test.tsx` (MASTER tag), `PhotoRotateSection.test.tsx`
- [x] 5. Kit v7.tsx (Background removed, Field focus ring) + demo baselines 21–22 — `uikit:typecheck`, `demo:baseline` (64 steps)
- [x] 6. e2e `parent-spreads-inspector.spec.ts` (browser check, rects, MS7, no page scroll, 40-spread perf gate: 0 LoAF); update `parent-spreads-edit.spec.ts`

## Manual test scenarios

1. Masters mode, Master A: set C = 5 → master canvas shows 5 columns per page; switch to Pages with Grid on → every Master A spread shows 5 columns, a None spread keeps the book grid.
2. Click the master logo → Photo inspector; Esc → master inspector again.
3. Margins link: on → type T = 20 → T/B/I/O all 20; Undo restores all four in one step.
