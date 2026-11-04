# spread-thumb-grey-backing

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item spread-thumb-grey-backing

## Scope

- [ ] Two-page spread rows in the Spreads panel (and master rows) paint nothing outside the paper: the row-wide thumb box `.editor-spread-thumb` has a transparent background and no shadow; the kit card radius / `--spread-card-shadow` sit on the paper (Owner 2026-11-05, faint grey backing left and right of narrow spreads).
- [ ] Single pages (page 1, last page) and the 19 × 23 cm kit card keep their computed styles.
- [ ] Regression: unit test on the chrome CSS rule plus an e2e of a two-page row on a narrow trim that fails on main.
- **Browser check:** 15 × 21 cm book, rows 2–3 / 4–5: white paper on the list background, no grey margins; Masters tab thumb the same.
- **Kit components:** `uikit#/demo` spread list MiniSpread (reference, no kit edits).
- **Hard nos:** no kit edits; no backing or shadow wider than the paper.
- **Test:** unit (chrome CSS) + Playwright e2e (box vs paper styles and pixels).
