## Implementation

- [x] 1. `defaultCover` back text = title; canvas back text styled like `#/demo` (M5). — `cover.test.ts`, `migrate.test.ts`, `CoverCanvas.test.tsx`; canvas CSS already matched (insets 12 % / 10 %, `--cover-ink`), no CSS change.
- [x] 2. Spine width row = read-only mono "N mm" text (rendered `#/demo`), slider removed. — `bookLookUi2.test.tsx` "shows the stored spine width as read-only mm text".
- [x] 3. `pagesNote` + `PAGE_MIN`/`PAGE_MAX` in `editorChromePanels.ts`; Pages row = pill + "20–120" hint + computed note. — `editorChromePanels.test.ts`, `BookSettingsKit.test.tsx`, `LayoutSection.test.tsx`.
- [x] 4. Book settings subtitle `${back || front || "Untitled book"} · applies to the whole book`. — `bookSettingsSubtitle` in `editorChromePanels.test.ts`, `BookSettingsKit.test.tsx`.
- [x] 5. Unit tests; old specs/tests that drove the slider or the fixed note move to the kit behaviour. — `design-inspector-book-cover`, `design-filmstrip-cover`, `design-r2-cover-book`, `kit10-inspector-book-endpaper`.
- [x] 6. e2e `design-r3-book-cover.spec.ts` (back text, spine width, pages). — 3 tests, 90/90 in `--repeat-each=30`.

## Manual test scenarios

1. Create a book "Lake trip", open Cover: back field and canvas back panel read "Lake trip" (bottom-left); edit it → canvas follows.
2. Cover inspector: Spine width reads "12 mm", no slider.
3. Click the book title: Book settings subtitle "Lake trip · applies to the whole book"; Pages pill "6", hint "20–120", note "Add 7 spreads to reach the 20-page minimum".

Results:

- problem (tooling, all 3): `pnpm agent manual-qa` timed out on `getByTestId('start-session')`; the welcome header intercepts the click on the 1 px button. Driver is `@albasov/ts-agent-rig/src/manual-qa.mjs`; this change does not touch the welcome screen.
- OK 1 (Playwright on live dev preview, 1440×900): back field and canvas read "Lake trip" bottom-left, same as kit `#/demo` step 13; edit → canvas follows (`design-r3-book-cover.spec.ts` M5).
- OK 2: Spine width reads "12 mm" mono, no input/slider; canvas spine / back = 12 / trim width.
- OK 3: subtitle "Lake trip · applies to the whole book"; Pages "6" + "20–120", note "Add 7 spreads to reach the 20-page minimum" on one line (268 × 15 px, no clip); 18 → "Add 1 spread…", 20 → "Pages are added in spreads of 2".
