# design-r9-letter-spacing

Tag: feature
Milestone: P1
Title: Bug: design-r9-letter-spacing: uppercase section titles match the kit

## Scope

- [ ] M57: every uppercase inspector section title matches the same title in kit `#/demo` (1440 × 900) in computed letter-spacing (± 0.01 px), font-size, font-weight, text-transform and color. Kit `Sec` titles (cover Front/Spine/Back/Material, book Page size/Binding/Print/Defaults, endpaper front/back Fill/Apply) are 11 px / 600 / uppercase / rgb(83, 81, 82) at 0.12em (1.32 px); kit Disclosure titles (spread Layout/Master & spacing/Background/Grid, photo Fit & crop/Rotate & flip/Adjust/Caption/Position & size/Frame style/Arrange) stay at 0.06em (0.66 px). One shared class carries the `Sec` tracking; non-uppercase text is unchanged; the r8 M48 endpaper row tops stay within 0.5 px.
- **Done when:** `e2e/design-r9-letter-spacing.spec.ts` green with `--repeat-each=30`; full chromium e2e suite and the perf spec green.
- **Browser check:** 1440 × 900, 19 × 23 book: select the cover, book title and "Endpaper · front"; the uppercase section titles are as wide as the kit `editor-cover-selected`, `editor-inspector-book` and `editor-endpaper-selected` steps (FILL 27.23 px, APPLY 42.11 px).
- **UI kit:** `uikit/src/sandbox/v7.tsx` (`Sec` :131), `uikit/src/components/app/ui.tsx` (Section eyebrow :51), `uikit/src/index.css` (`.eyebrow` :237). UI ref: `uikit#/demo` steps `editor-cover-selected`, `editor-frame-selected`, `editor-pages-mode`, `editor-inspector-book`, `editor-endpaper-selected`.
- **Source:** Owner Must relayed by the Designer, round 9, 2026-11-01, on prod 413bb41.
