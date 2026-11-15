# cover-pdf-kit

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item cover-pdf-kit

## Scope

Must CP1 of the Designer `cover-pdf` Spec (2026-11-15): the kit (`uikit/`) side of "Export PDF writes the pages PDF and a `…-cover.pdf`". Core painter / preflight and the prod dialog are separate items.

- [x] `uikit/src/demo-parts/dialogs.tsx` PrintDialog: Cover row `print-cover` between Printer and Imposition, always present (1 per sheet `{W} × {H} cm · spine {s} mm`, 2-up / 4-up `None with booklets`); bleed label variant (§2.1.2); run text `Cover · p%` (§2.2); done line `print-done-cover` + footer `Open pages` (`print-open`) / `Open cover` (`print-open-cover`) / Done; booklets keep `Open PDF` (C1, C8, C10)
- [x] `uikit/src/demo-parts/printCheck.ts`: `printSummary` `+ cover`; `printProgress` units = sheets + 1; the 8 cover Check rules with `scope: 'cover'` (Spec §2.1.4 texts, severities, order; after the page rows of the same severity; no page list; hidden for booklets); skipped-photos `cover` token; `openSamplePdf` for the cover file (C9)
- [x] `uikit/src/features/pages.tsx` `pdf-export`: Issues shows the Cover row; new scenario `Cover check` (front photo 182 ppi, spine text cut, spine text 5.7 pt through a 4 mm manual spine); 2-up scenarios show `None with booklets`
- [x] `uikit/src/sandbox/v7.tsx`: spine paint `#353332` → `#3E3C3B` on the cover and the sheet gradient (C5)
- **Kit components:** `PrintDialog`, `printCheck`, `CoverSpread`
- **Demo:** `#/demo` steps `print-options` (Cover row), `print-done` (4-up: `Open PDF` only), cover steps 09 / 13 (spine colour); baselines are not tracked, re-captured as evidence
- **Browser check:** kit `#/demo` Print dialog at 1440 × 900: Cover row `33.8 × 24 cm · spine 12 mm` for the A5 demo book, `42.2 × 26 cm · spine 12 mm` for the 19 × 23 cm feature book; Imposition label top 177.63 px in the dialog (+30.85)
- **Done when:** `e2e/kit-pdf-export.spec.ts` locks the Cover row (both layouts, paint probe), the `Cover check` rows (severities, no page list, none with 2-up), the two-line done state with Open pages / Open cover (booklets Open PDF only), `Cover · p%`, and the kit cover spine rgb(62, 60, 59) on `#/full/cover-editor` (computed + pixel); changed e2e green; `pnpm roadmap check` green. `e2e/kit10-cover.spec.ts` drives the prod editor (`/`), whose spine stays #353332 until item `cover-pdf` (CP4), so it keeps rgb(53, 51, 50) here
- **Musts:** kit and prod are one design (Spec §2); qa.mjs test ids unchanged
- **Hard nos:** no changes under `src/**`, `uikit/scripts/qa.mjs`, `uikit/src/kit/pages.json`
- **Test:** Playwright kit e2e (`kit-pdf-export`, `kit10-cover`)
- **UI kit:** `uikit#/feature/pdf-export`
- **Source:** Designer Spec `cover-pdf` (orch `shared/design/cover-pdf/spec.md`) §2.1–2.3, §3 "Kit", C1, C5, C8, C9, C10
- **Depends:** pdf-export-kit, cover-editor-kit
