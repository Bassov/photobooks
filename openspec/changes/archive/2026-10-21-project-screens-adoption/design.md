## Decisions

1. **Reuse `src/ui` only** — `EmptyState`, `Button`, `Status`, `Badge`, `Dialog`/`DialogTitle`; no new primitives. Tokens already in `docs/design.md` / `tokens.css` (status, chrome, destructive).
2. **Home** — empty and IDB-error panels → `EmptyState` + `Button` actions; chrome actions → `Button`; permission hint / `homeError` → `Status`. Keep `data-testid`s and named `home` scrollport. Book list stays non-virtualized small list.
3. **Permission / lock** — quiet chrome banners via `Status` + primary Grant `Button` (product pattern in `docs/design.md`); kit AppModal demos are specimen-only. When ticking migration audit, set target to banner + Status/Button (not modal). FSA re-grant / lock acquire unchanged (presentation only).
4. **Save indicator** — wrap label in `Status` + phase-colored `Badge` (dot); keep `saveIndicatorLabel` + `data-save-phase` / `data-testid="save-indicator"`.
5. **Missing assets** — rebuild `RelinkDialog` shell on `Dialog` + `DialogTitle` + row `Badge`; pure modules/`statusStore` unchanged. Named `relink-list` scrollport.
6. **Mutation** — remove `!src/editor/HomeScreen.tsx` from `stryker.config.mjs` + reason in `stryker.mutate.md`; strengthen `HomeScreen.test.tsx` until stryker:diff ≥85 / 0 NoCoverage. Gate edit is exclude shrink only.

## Touch-set & Test Plan

- Files: `src/editor/HomeScreen.tsx` (+css/test), `EditorTopBar.tsx` (+css), `relink/RelinkDialog.tsx` (+styles/test), `stryker.config.mjs`, `stryker.mutate.md`, `docs/design.md` migration rows; `homeActionDisabled.ts`; `saveIndicatorLabel` badge color.
- Reuse: existing Button/Status/Badge/Dialog; `saveIndicatorLabel`; Relink pure helpers.
- Tests: unit Home empty/error/permission/actions; TopBar save/lock/grant; Relink Dialog+Badge; e2e `recents-home`, `permissions-locks`, save-indicator asserts, `missing-assets-relink` (incl. named relink-list scroll). `ui-review` + manual-qa before archive.
