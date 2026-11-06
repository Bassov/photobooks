# printer-presets-kit-book

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item printer-presets-kit-book

## Scope

Kit part (item 2b) of the Designer `printer-presets` spec (2026-11-05): Book settings → PRINT. Kit only (`uikit/`); prod follows in printer-presets-core / printer-presets.

- [ ] `uikit/src/sandbox/v7.tsx` Book settings PRINT: Printer select (268 wide, 32 high, optgroups Print shops / Custom, `aria-label="Printer"`, `book-print-profile`), hint `book-print-hint` (2xs, lh 16), warnings `book-print-issue` (12/400 lh 16.8 #8a5a12, TriangleAlert 12), B/S fields `mt-3` with bleed / safe from the profile (D4); picking a profile is one undo step and announces "Printer: {name}" politely.
- [ ] Binding → Pages: range hint `book-pages-range` = `20–min(120, profile max)`; trim and page count never change on a pick.
- [ ] `uikit/src/features/pages.tsx` `inspector`: scenario `book-lulu` (Lulu picked, 2 warnings).
- **Browser check:** kit `#/full/inspector` at 1440 × 900, scenarios book / book-lulu: Printer select 268 × 32; B/S fields and DEFAULTS title 66 px lower than before; each warning adds 8 + 16.8 px per line (±0.5 px, DOM measured).
- **Hard nos:** no `src/**` or `e2e/` changes; no blue / teal; no page-level H/V scroll.
- **UI kit:** `uikit#/feature/inspector` scenarios `book`, `book-lulu`.

## Done when

- Below the select everything moves down 66 px (DEFAULTS 788.61 → 854.61 ±0.5 at 1440 × 900); each warning adds 8 px + 16.8 px per line.
- Picking a profile is one undo step (bleed clamped into the profile range, safe = profile safe); trim and page count unchanged, out-of-range values show warnings.
- `pnpm uikit:qa:quick` green with kit qa asserts for the above.
