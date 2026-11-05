# printer-presets-kit

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item printer-presets-kit

## Scope

Kit part (item 2a) of the Designer `printer-presets` spec (2026-11-05): Settings → Print presets, the print profile editor dialog and the Print dialog Printer row. Kit only (`uikit/`); Book settings → PRINT in the kit (`uikit/src/sandbox/v7.tsx`) is the later item printer-presets-kit-book; prod follows in printer-presets-core / printer-presets.

- [ ] `uikit/src/demo-parts/settings.tsx`: Print presets section — lead, "Default for new books" select 240 × 32 (optgroups Print shops / Custom), eyebrows "Print shops" / "Custom" (+ New profile), rows with name + one-line summary (ellipsis + `title`), `Default` badge, `Duplicate` on built-ins, `Edit…` + 28 × 28 ••• menu (176 wide: Duplicate, Delete… #a8403a, kit AlertDialog confirm) on custom rows, empty-state text; the 3 stub rows (incl. Home printer, D7) go; nav row `settings-nav-print`, `aria-current` only on the current section.
- [ ] New `uikit/src/demo-parts/printProfiles.tsx`: kit sample catalog (numbers are sample data, D8) + `PrintProfileDialog` (560 wide, radius 14, padding 20 24, 132 px label column, number fields 96 wide (step 64), groups PAGE / PAGES / SPINE AND COVER / PHOTO QUALITY, live spine hint, error ring + message, Save disabled on error, table spine read-only text).
- [ ] `uikit/src/demo-parts/session.tsx`: custom profiles + default id in the kit session; `uikit/src/demo-parts/dialogs.tsx` PrintDialog: Printer row, the profile's bleed in the checkbox label and summary.
- [ ] `uikit/src/features/pages.tsx` `site-settings`: scenarios `print`, `print-empty`, `print-edit`, `print-invalid` (inspector `book-lulu` is item 2b).
- **Browser check:** kit `#/full/site-settings` at 1440 × 900, scenarios print / print-edit: select 240 × 32, ••• 28 × 28, menu 176 wide, dialog 560 wide with radius 14 and 132 px label column, number fields 96 / 64 wide (±0.5 px, DOM measured).
- **Hard nos:** no fake, dead or disabled-stub controls (D2); no blue / teal; no page-level H/V scroll; no `src/**`, `e2e/` or `uikit/src/sandbox/v7.tsx` changes.
- **UI kit:** `uikit#/feature/site-settings` scenarios `print`, `print-empty`, `print-edit`, `print-invalid`.

## Done when

- Settings print section and editor dialog match the spec values (sizes, colours, type) at 1440 × 900 within ±0.5 px; the 4 scenarios render.
- Delete asks for confirmation; deleting the default makes Generic the default.
- Editor: an invalid field shows the ring + message and disables Save; the spine hint updates live.
- `pnpm uikit:qa:quick` green with kit qa asserts for the above.
