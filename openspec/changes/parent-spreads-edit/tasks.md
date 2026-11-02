## Implementation

- [ ] 1. Core: `editableSpread` / `parentAsSpread`, `updateSpread` parent fallback, `resolveSpread` + two-page parent geometry; unit + PBT.
- [ ] 2. Core: `addParent` / `renameParent` / `removeParent` ops in `applyBookOp` + history labels; unit + PBT (delete → None).
- [ ] 3. bookStore: parent paint snapshots; notify the parent and only the spreads whose parent changed; unit test.
- [ ] 4. Editor lookups: frame gesture, handle gesture, frame selection use `editableSpread`; mode switch clears the frame selection.
- [ ] 5. Masters list: rows with thumb, select, New master, Rename (inline), Delete; component test.
- [ ] 6. Masters canvas (selected parent, fitted, editable) + Inspector hint in Masters mode; component test.
- [ ] 7. e2e `parent-spreads-edit.spec.ts` (Browser check + empty / rename / delete) and `kit10-masters.spec.ts` update.
- [x] 8. Roadmap item `parent-spreads-inspector` (Depends parent-spreads-edit) via `pnpm roadmap add … --after parent-spreads-edit`: master inspector + demo step 22.

## Manual test scenarios

1. Painter fixture: Masters → Master A on the canvas; New master adds "Master C"; rename it; delete it.
2. Apply Master A to every spread, move its logo once in Masters mode → every spread shows the new position.
3. Delete Master A while spreads use it → those spreads show no parent layer (None).
