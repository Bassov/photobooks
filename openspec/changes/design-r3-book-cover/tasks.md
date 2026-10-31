## Implementation

- [x] 1. `defaultCover` back text = title; canvas back text styled like `#/demo` (M5). — `cover.test.ts`, `migrate.test.ts`, `CoverCanvas.test.tsx`; canvas CSS already matched (insets 12 % / 10 %, `--cover-ink`), no CSS change.
- [x] 2. Spine width row = read-only mono "N mm" text (rendered `#/demo`), slider removed. — `bookLookUi2.test.tsx`.
- [x] 3. `pagesNote` + `PAGE_MIN`/`PAGE_MAX`; computed spreads note. — `editorChromePanels.test.ts`, `BookSettingsKit.test.tsx`, `LayoutSection.test.tsx`.
- [x] 4. Book settings subtitle `${back || front || "Untitled book"} · applies to the whole book`. — `bookSettingsSubtitle` in `editorChromePanels.test.ts`, `BookSettingsKit.test.tsx`.
- [x] 5. Old specs/tests that drove the slider or the fixed note move to the kit behaviour. — `design-inspector-book-cover`, `design-filmstrip-cover`, `design-r2-cover-book`, `kit10-inspector-book-endpaper`.
- [x] 6. Rework (designer ruling): computed spine width (`src/core/pages.ts`) in inspector, canvas and cover card; formula in `docs/design.md`. — `pages.test.ts`, `bookLookUi2.test.tsx`, `SpreadsPanel.cover.test.tsx`.
- [x] 7. Rework: `setPageCount` op (clamp 20–120, step 2, add/remove spreads at the end, one undo step) + editable Pages box (no spin arrows). — `pages.test.ts`, `BookSettingsKit.test.tsx`; `stryker:diff` 100 % (74 killed, 1 timeout, 0 survived).
- [x] 8. e2e `design-r3-book-cover.spec.ts` (5 tests) 150/150 at `--repeat-each=30 --workers=4`; the other 4 changed specs 569/570 (1 fixture `NotReadableError` in an unrelated filmstrip test); full chromium suite: 322/336 at 7 workers, the 14 failures are timeouts / LoAF gates / fixture `NotReadableError` under load: 13 pass on a `--workers=1` rerun (CI setting), the 14th (`filmstrip.spec.ts:1585` 1000-photo LoAF gate, 34 ms) then passes 5/5.

## Manual test scenarios

1. Create a book "Lake trip", open Cover: back field and canvas back panel read "Lake trip" (bottom-left); edit it → canvas follows.
2. Cover inspector: Spine width reads "12 mm", no slider; set Pages to 40 → "16 mm" and a wider canvas spine.
3. Click the book title: subtitle "Lake trip · applies to the whole book"; Pages box "6" (no arrows), hint "20–120", note "Add 7 spreads to reach the 20-page minimum"; type 10 → 20 and 10 spreads; 200 → 120; 33 → 34; undo restores; reload keeps it.

Results:

- OK 1 (Playwright, dev server, 1440×900): back field and canvas read "Lake trip" bottom-left; edit → canvas follows (`design-r3-book-cover.spec.ts` M5).
- OK 2: Spine width "12 mm" mono, no slider; Pages 40 → "16 mm", canvas spine / back = 43.5 / 402.3 px = 16 / 148 mm (A5).
- OK 3: subtitle and note as listed; Pages box matches kit `Val` (FIELD fill, 6 px radius, 4 / 8 px pad, 26.8 px high, no arrows); 10 → 20, 200 → 120, 33 → 34, undo "Page count", reload keeps 24 and "12.8 mm".
