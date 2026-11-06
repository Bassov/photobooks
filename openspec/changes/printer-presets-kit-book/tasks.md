## Implementation

- [x] 1. `Doc.print` + `printSafe`; folios (v7 / canvas / chrome) read it. (b653e83b)
- [x] 2. `printProfiles.tsx`: `profileHint`, `printIssues`, `pagesRange`, `PrintCustomsCtx`. (b653e83b)
- [x] 3. `BookInspector` PRINT: Printer select (one undo step, live region), hint, warnings, B/S `mt-3` from the doc; Pages range from the profile. (b653e83b; qa "printer-presets-kit-book: pick Lulu = one undo step")
- [x] 4. `DemoEditor`: provide session customs; PrintDialog uses the doc's profile. (b653e83b)
- [x] 5. `features/pages.tsx` `inspector` scenario `book-lulu` + `what` text. (b653e83b)
- [x] 6. Kit qa asserts (positions, warnings, pick + undo). (`uikit/scripts/qa.mjs` printer-presets-kit-book block; `pnpm uikit:qa:quick` 429 passed, 0 failed)

## Manual test scenarios

1. Kit `#/feature/inspector` → Book settings: Printer = Generic, hint "5–50 cm · 20–120 pages · photos ≥ 200 ppi", no warnings, B 3 / S 8.
2. Pick Lulu · Photo book → B 3.175, S 12.7, "prints at least 24 pages" warning; Ctrl+Z → Generic, B 3, S 8.
3. Scenario "Lulu picked" → two warnings (page width, page count).

Results (kit-only PR: `pnpm agent manual-qa` drives the prod editor, not the kit; evidence = kit qa, headless Chromium 1440 × 900):

- OK 1 — select 268 (258 + 10 scrollbar) × 32 at PRINT title + 26.84; hint + 64.84, 11/16; B/S + 92.84, DEFAULTS + 195.69 (= 788.61 → 854.61); B3mm / S8mm; Pages 20–120.
- OK 2 — Lulu: B3.175mm / S12.7mm, size 19×23 and 20 pages unchanged, 1 warning, DEFAULTS + 41.6 (8 + 2 × 16.8); live "Printer: Lulu · Photo book"; Ctrl+Z → generic, B3mm / S8mm, DEFAULTS back to 195.69.
- OK 3 — 2 warnings 12px/16.8px 400 rgb(138, 90, 18), icon 12×12, 8 px apart; both paint on top (elementFromPoint).
