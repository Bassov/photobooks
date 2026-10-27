## Implementation

- [x] 1. Core: `duplicateSpread` + op; `removeSpread` re-applies page roles; unit + PBT model.
- [x] 2. `spreadsPanelModel`: window, selection fallback, post-delete neighbour; unit tests.
- [x] 3. `SpreadThumb` (thumb-only SpreadView, memoized).
- [x] 4. `requestSpreadReveal` + Pasteboard subscription.
- [x] 5. `SpreadsPanel`: windowed list, menu actions, keys, Undo toast; wire in `EditorShell`.
- [x] 6. Specs delta (`book-core`, `editor-shell`).
- [x] 7. E2E `spread-list-panel.spec.ts`.

## Manual test scenarios

1. Click a thumbnail → pasteboard scrolls to it.
2. Add / duplicate / delete from the menu; Undo restores.
3. Last spread: delete disabled.
4. No page-level H/V scroll.

Evidence: `pnpm agent manual-qa` cannot run here. All 4 scenarios time out because the
welcome `<header>` intercepts the start-session click. `WelcomeScreen.tsx` is not in this
diff, so this is a harness/main issue and out of scope. Scenarios 1–4 are covered by
`e2e/spread-list-panel.spec.ts`, which passes (3/3, chromium):

- OK 1 — "spreads panel lists thumbnails, navigates, and manages spreads": click scrolls the pasteboard to the spread.
- OK 2 — same test: duplicate (Ctrl+D), delete (Delete) and the toast Undo restore the spread; add goes through the row menu.
- OK 3 — "last spread cannot be deleted": Delete on the only spread leaves 1 row (the menu-disabled state is covered by unit `canDeleteSpread`).
- OK 4 — all 3 tests assert `assertDocumentFitsViewport`; the long-list test also asserts `spreads-list` is the vertical scrollport, with no page-level H/V scroll.
