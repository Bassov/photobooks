## Decisions

1. The kit has two uppercase title kinds (measured on `uikit#/demo` at 1440 × 900): the collapsible Section eyebrow (`.eyebrow`, 0.06em = 0.66 px) and the v7 `Sec` h3 (`tracking-[0.12em]` = 1.32 px); both 11 px / 600 / `rgb(83, 81, 82)`. Prod uses `.inspector-eyebrow` (0.06em) for both, and `.endpaper-sec-title`'s 0.12em loses to it on cascade order.
2. One shared modifier `.inspector-eyebrow.inspector-sec-title` in `EditorShell.css` next to `.inspector-eyebrow` sets `letter-spacing: 0.12em`; the compound selector wins regardless of CSS order. All other eyebrow properties stay shared. Remove the dead `letter-spacing` from `.endpaper-sec-title`.
3. Apply the modifier to the `Sec`-kind titles only: Cover (Front, Spine, Back, Material), Book settings (Page size, Binding, Print, Defaults), Endpaper (Fill, Apply). Disclosure / Fit & crop / Rotate & flip titles keep 0.06em like the kit.
4. Document the `Sec` title in `docs/design.md` (Type row).

## Touch-set & Test Plan

- Files: `src/editor/EditorShell.css`, `src/editor/EndpaperCanvas.css`, `src/editor/CoverSection.tsx`, `src/editor/BookSettingsSection.tsx`, `src/editor/EndpaperSection.tsx`, `docs/design.md`, new `e2e/design-r9-letter-spacing.spec.ts`.
- Reuse: `.inspector-eyebrow`; e2e fixtures `openLibraryBook`, `choosePhotoFolder`, `dragPlaceFirstFilmstripItem`.
- Unit: the three sections' titles carry `inspector-sec-title` (and only those): extend `bookLookUi.test.tsx` (endpaper Fill/Apply), `CoverParity.test.tsx` (cover), `BookSettingsKit.test.tsx` (book settings).
- e2e: per state, each audited title's computed letter-spacing equals the kit within 0.01 px and font-size / weight / transform / color equal the kit; the r8 M48 endpaper row tops stay within 0.5 px.
