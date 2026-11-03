## Implementation

- [x] 1. Core: `reorderFrames` + `setFramesLocked` ops (arrange.ts, applyBookOp.ts, index), history labels; unit + PBT; align/distribute skip-locked tests.
- [x] 2. Glyphs (9 lucide) + `IconButton` `disabledReason`; Icon / IconButton tests; docs/design.md row.
- [x] 3. Inspector model: `multi` view, `multiSummary`, `alignState`, `selectionCaption`; tests.
- [x] 4. Inspector UI: header + meta, `MultiSections` (Align & distribute, Arrange on the set, Delete N frames); Inspector tests.
- [x] 5. Set actions: frameArrange set helpers, shortcuts, context menu on the set (+ Delete N frames); tests.
- [x] 6. Kit: AlignSection (labels, testids, groups, unlocked-only, reasons, caption), ArrangeSection set label + fwd/bwd, multi meta rule, page edge line.
- [x] 7. e2e `multi-select.spec.ts`: distribute equal gaps, align with locked, Undo, Delete 3 frames, menu on the set, LoAF on a click; pasteboard spec delta.

## Manual test scenarios

1. Select three frames on a spread (Shift+click): header "Multiple selection", meta "3 frames · …"; Distribute horizontally → equal gaps; Undo restores.
2. Two frames selected: Distribute buttons dimmed but focusable, Tab onto one shows "Select 3 or more unlocked frames".
3. Lock one of three, align left: the locked frame stays; caption ends "· 1 locked, skipped".
4. Right-click a selected frame: menu keeps the set; Bring to front moves the block; "Delete 3 frames" removes all.

- Harness problem: `pnpm agent manual-qa` blocked at the welcome screen for all four (the header intercepts the `start-session` click); no product run.
- OK (e2e evidence, `e2e/multi-select.spec.ts` part 4, 6 passed): 1 equal gaps ±0.01 mm + one Undo; 2 dimmed, focusable, reason tooltip, 28×28; 3 locked frame stays put; 4 menu keeps the set, lock on the set, Arrange + "Delete 3 frames"; Distribute click logs no LoAF.
- UI review: no blocking findings (IconButton primitive + `disabledReason` row in docs/design.md; focusable disabled with `aria-describedby`; document fits viewport).
