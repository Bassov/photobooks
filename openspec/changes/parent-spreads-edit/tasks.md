## Implementation

- [x] 1. Core: `editableSpread` / `parentAsSpread`, `updateSpread` parent fallback, `resolveSpread` + two-page parent geometry; unit + PBT.
- [x] 2. Core: `addParent` / `renameParent` / `removeParent` ops in `applyBookOp` + history labels; unit + PBT (delete → None).
- [x] 3. bookStore: parent paint snapshots; notify the parent and only the spreads whose parent changed; unit test.
- [x] 4. Editor lookups: frame gesture, handle gesture, frame selection use `editableSpread`; mode switch clears the frame selection.
- [x] 5. Masters list: rows with thumb, select, New master, Rename (inline), Delete; component test.
- [x] 6. Masters canvas (selected parent, fitted, editable) + Inspector hint in Masters mode; component test.
- [x] 7. e2e `parent-spreads-edit.spec.ts` (Browser check + empty / rename / delete) and `kit10-masters.spec.ts` update.
- [x] 8. Roadmap item `parent-spreads-inspector` (Depends parent-spreads-edit) via `pnpm roadmap add … --after parent-spreads-edit`: master inspector + demo step 22.

## Manual test scenarios

1. Painter fixture: Masters → Master A on the canvas; New master adds "Master C"; rename it; delete it.
2. Apply Master A to every spread, move its logo once in Masters mode → every spread shows the new position.
3. Delete Master A while spreads use it → those spreads show no parent layer (None).

`pnpm agent manual-qa`: problem (harness, same on main) for 1–3 — `start-session` click intercepted by the welcome `<header>`; no scenario reached the editor. Evidence instead (e2e, painter `?fixture=`, 2026-11-02):

- 1 OK — `parent-spreads-edit.spec.ts` "Browser check" (New master) + "rename and delete".
- 2 OK — "Browser check": logo moved once in Masters mode (>20 mm x, >10 mm y); all 10 spreads moved by the same mm (±0.5 mm), document fits the viewport.
- 3 OK — "rename and delete": spread shows no `parent-layer`, Master radio = None.
- Scrollport OK — 18 masters scroll inside `masters-list`; "New master" stays in view; no page scroll.
