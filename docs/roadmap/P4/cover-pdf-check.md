# cover-pdf-check

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item cover-pdf-check
Status: done

## Scope

Core preflight part of the Designer feature cover-pdf (Must CP3, decision C9): the cover Check rows as their own preflight rules, plus the cover PDF file name. No UI (the prod dialog is item cover-pdf); the painter is item cover-pdf-paint.

- [ ] `src/core/print/preflight.ts`: 8 cover rules appended after `bleed-hazard` (cover-asset-missing, cover-asset-modified, cover-dpi-below-min, cover-dpi-below-warn, cover-not-srgb, spine-text-small, spine-text-cut, cover-front-empty); only the worse dpi row; front ppi = the editor's `coverPanelPpi`; spine pt = min(coverW·12/848, spine/2) mm × 72/25.4 vs `minFontPt`; cut = text advance > trimH − 2·safe; empty spine text → no spine rows. Cover rows only for 1 per sheet and only when the caller asks for them (an option), so the current Print dialog is unchanged.
- [ ] `src/core/print/preflightText.ts`: `PreflightRow.scope: 'pages' | 'cover'`, cover texts exactly as the Designer table, no page list on cover rows.
- [ ] `src/core/print/pdfFileName.ts`: `pdfCoverFileName` → `{slug}-{preset|WxHcm}-cover.pdf`.
- **Browser check:** N/A (core only; Print dialog and print e2e unchanged).

## Done when

- [ ] Each of the 8 rules has a unit test that fires it and one that does not; PBT: cover rows always have scope `cover` and no pages, never more than one dpi row, none for 2-up / 4-up.
- [ ] Existing Print dialog / print e2e behaviour unchanged (cover rows only on request).
- [ ] `pdfCoverFileName` unit test for preset and W×H names.
- [ ] `pnpm roadmap check` green; item Status: done.
