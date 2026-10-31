## Implementation

- [x] 1. `defaultCover` back text = title; canvas back text styled like `#/demo` (M5). — `cover.test.ts`, `migrate.test.ts`, `CoverCanvas.test.tsx`; canvas CSS already matched (insets 12 % / 10 %, `--cover-ink`), no CSS change.
- [x] 2. Spine width row = read-only mono "N mm" text (rendered `#/demo`), slider removed. — `bookLookUi2.test.tsx`.
- [x] 3. `pagesNote` + `PAGE_MIN`/`PAGE_MAX`; computed spreads note. — `editorChromePanels.test.ts`, `BookSettingsKit.test.tsx`, `LayoutSection.test.tsx`.
- [x] 4. Book settings subtitle `${back || front || "Untitled book"} · applies to the whole book`. — `bookSettingsSubtitle` in `editorChromePanels.test.ts`, `BookSettingsKit.test.tsx`.
- [x] 5. Old specs/tests that drove the slider or the fixed note move to the kit behaviour. — `design-inspector-book-cover`, `design-filmstrip-cover`, `design-r2-cover-book`, `kit10-inspector-book-endpaper`.
- [ ] 6. Rework (designer ruling): computed spine width (`src/core/pages.ts`) in inspector, canvas and cover card; formula in `docs/design.md`.
- [ ] 7. Rework: `setPageCount` op (clamp 20–120, step 2, add/remove spreads at the end, one undo step) + editable Pages box (no spin arrows).
- [ ] 8. Unit tests (`pages.test.ts`, `BookSettingsKit.test.tsx`, `bookLookUi2.test.tsx`, `SpreadsPanel.cover.test.tsx`); e2e `design-r3-book-cover.spec.ts` (6 tests) burn-in `--repeat-each=30`; full chromium suite once.

## Manual test scenarios

1. Create a book "Lake trip", open Cover: back field and canvas back panel read "Lake trip" (bottom-left); edit it → canvas follows.
2. Cover inspector: Spine width reads "12 mm", no slider; set Pages to 40 → "16 mm" and a wider canvas spine.
3. Click the book title: subtitle "Lake trip · applies to the whole book"; Pages box "6" (no arrows), hint "20–120", note "Add 7 spreads to reach the 20-page minimum"; type 10 → 20 and 10 spreads; 200 → 120; 33 → 34; undo restores; reload keeps it.

Results:
