# design-r10-inspectors

Tag: feature
Milestone: P1
Title: Bug: design-r10-inspectors: Cover/Book/Photo inspectors and segmented controls match the kit

## Scope

- [ ] M59: the Cover and Book settings inspectors use the kit v7 `Head` / `Sec` / `Row` rhythm the Endpaper inspector already matches (M48). At 1440 × 900, y relative to the panel top, kit `#/demo`: head title 16.0 (13 px / 500), subline 36.84, first section title 73.64; Cover SPINE 286.70, BACK 447.23, MATERIAL 576.92; Book BINDING 330.48, PRINT 506.70, DEFAULTS 636.39, title to first row 26.85. The Cover "Title font" / "Cover" / "Finish" native selects and the read-only pills (Hardcover, Paper white) stay as they are (open Owner questions); the 36 px Title font select over the kit 26.84 px `Val` leaves a 9.16 px residual below it.
- [ ] M60: the Photo inspector opens on a collapsible PHOTO section (kit title y 57.75) and shows open chevrons on PHOTO, FIT & CROP and ROTATE & FLIP (titles at x 1172); title to first control, Straighten to Quarter turn (35.79) and the closed-row pitch (37) match the kit; the Quarter turn note is rgb(83, 81, 82).
- [ ] M61: segmented-control labels are 13 px / 500 in both states (Book Portrait/Landscape and cm/mm, layout picker All / My templates, Create dialog Portrait/Landscape); the Photo Fill / Fit labels stay 12 px and become 500.
- **Done when:** `e2e/design-r10-inspectors.spec.ts` green with `--repeat-each=30`; r8 M48 endpaper rows and r9 M57 title type stay exact; full chromium e2e suite and the perf spec green.
- **Browser check:** 1440 × 900, 19 × 23 book: select the cover, the book title, a filled frame and open the Create dialog; positions within 0.5 px of `uikit#/demo` steps `editor-cover-photo-and-title`, `editor-inspector-book`, `editor-frame-selected`, `create-book-dialog`, `editor-new-blank-book`.
- **UI kit:** `uikit/src/sandbox/v7.tsx` (`Head` :150, `Sec` :130, `Row` :145, `SegC` :138), `uikit/src/sandbox/inspector.tsx` (Photo / Fit & crop / Rotate & flip :103-166), `uikit/src/components/app/ui.tsx` (`Section` :62), `uikit/src/components/app/controls.tsx` (`SliderRow` :21, `Segmented` :45). UI ref: `uikit#/demo`.
- **Source:** Owner Must relayed by the Designer, round 10 (Designer review r9 of prod, 2026-11-01).
