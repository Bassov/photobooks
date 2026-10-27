## Implementation

- [ ] 1. Core: `duplicateSpread` + op; `removeSpread` re-applies page roles; unit + PBT model.
- [ ] 2. `spreadsPanelModel`: window, selection fallback, post-delete neighbour; unit tests.
- [ ] 3. `SpreadThumb` (thumb-only SpreadView, memoized).
- [ ] 4. `requestSpreadReveal` + Pasteboard subscription.
- [ ] 5. `SpreadsPanel`: windowed list, menu actions, keys, Undo toast; wire in `EditorShell`.
- [ ] 6. Specs delta (`book-core`, `editor-shell`).
- [ ] 7. E2E `spread-list-panel.spec.ts`.

## Manual test scenarios

1. Click a thumbnail → pasteboard scrolls to it.
2. Add / duplicate / delete from the menu; Undo restores.
3. Last spread: delete disabled.
4. No page-level H/V scroll.
