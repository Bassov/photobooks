# design-r31-cover-check

Tag: lite
Milestone: P4
Title: Bug: /next-roadmap-item design-r31-cover-check
Status: done

Designer parity cover-pdf (2026-11-16, Must M122): the Print dialog Check block never shows cover rows (Spec cover-pdf 2.1.4 / C9, CP4). The PDF worker check calls `preflight` without `cover`, and the front photo never reaches `colorWarnings`, so spine-text-cut, cover-front-empty and cover-not-srgb never appear. Kit reference: `#/feature/pdf-export` scenarios "Cover check" and "No bleed".

## Scope

- [x] The worker `check` request carries the chosen layout; with 1 per sheet it runs the cover rules with the spine text measured in the cover painter's book font (worker-side, no DOM) and the front photo's colour.
- [x] The Print dialog sends its layout and re-checks when the layout changes; 2-up / 4-up show no cover rows.
- [x] Unit test (src/core/pdf worker check): long spine text + 1 per sheet → spine-text-cut; 2-up → no cover rows; no front photo → cover-front-empty; non-sRGB front → cover-not-srgb.
- [x] e2e `e2e/design-r31-cover-check.spec.ts`: long spine text shows the visible (paint-probed) spine-text-cut row at 1 per sheet, none at 2-up; a new book shows cover-front-empty.
- **Browser check:** Print dialog on a book with a spine text longer than the spine: the Check block lists "Spine text is longer than the spine and ends in “…”" at 1 per sheet and drops it at 2-up.
