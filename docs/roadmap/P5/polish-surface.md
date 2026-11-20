# polish-surface

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item polish-surface

## Scope

Designer Spec walkthrough-polish-review (2026-11-20), item 3: P4 "Radii by role", P5 "One shadow ink", P7 "One warning ink" (Owner Q-21 2026-11-20: all six polish items in order). Kit + prod in one PR; ≤6 source files plus tests.

- [ ] P4 radius tokens in `uikit/src/index.css` and `styles/tokens.css`: 2 page/thumb · 4 badge/chip · 6 controls ≤ 28 px · 8 controls 32–36 px · 14 dialogs, popovers, cards · one pill token `--radius-full` 9999px (also behind Tailwind `rounded-full`) · 10 only for a nested segmented track
- [ ] P4 most visible literal pills (999px, 9999px, 3.36e7) on the token: top bar pills, editor chrome chips; remaining radius users listed in the PR body as a follow-up
- [ ] P5 one shadow ink rgb(20 20 19) for `--shadow-xs/sm/md/lg`, `--page-shadow`, `--shadow-book`, `--shadow-book-hover` (same alphas), kit and prod
- [ ] P7 `--warning-ink: #845510` (kit + prod) for the Low-res chip, Book settings PRINT warnings and Print Check warning rows
- [ ] Tests that pin the old look updated (BookSettingsPrinter unit, page-shadow e2e, editor chrome radius unit)
- **Browser check:** 1440 × 900 prod: top-bar pill radius 9999px, Print Check warning row and PRINT warning text rgb(132, 85, 16), page shadow on rgba(20, 20, 19, …)
- **Done when:** kit and prod tokens equal the Spec values (computed-style checks on one control, one dialog, one pill, one chip; shadow ink rgb(20, 20, 19)); warning text on PRINT settings, Print Check row and Low-res chip computes to rgb(132, 85, 16); updated pins green; no other visual change beyond P4/P5/P7
- **Hard nos:** no edits to uikit/src/sandbox/{chrome,store,viewport,v7}.tsx, uikit/src/demo-parts/editor.tsx, uikit/scripts/demo-capture.mjs, demo baselines, src/render/CoverView.\*, BookObject.tsx, spread-list Cover row, src/core/\*\*, .github/\*\*, playwright.config.ts; library cards stay on their own shadows (cover-empty-cloth)
- **UI kit:** `uikit#/demo` editor top bar, Print dialog (Designer Spec `walkthrough-polish-review/spec.md` P4, P5, P7)
