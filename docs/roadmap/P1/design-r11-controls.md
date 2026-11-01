# design-r11-controls

Tag: feature
Milestone: P1
Title: Bug: design-r11-controls: input font, secondary/pill buttons and Settings match the kit

## Scope

- [ ] M68: no `<input>` / `<textarea>` / `<select>` renders in the browser default font (Arial 13.33 px) on the walked editor steps, library, settings and Create book dialog (root `font: inherit` in the app base layer). Cover Front/Spine/Back title fields, Photo Caption and sliders, Book Pages: Inter 13; Book W/H inputs and PRINT Bleed/Safe values: ui-monospace 13, as kit `#/demo`.
- [ ] M70: shared `Button` box model matches the kit: no border, `sm` padding 0 12, `md` padding 0 16; `secondary` = kit outline + `shadow-xs` (90° left/right, Crop, Settings "Change library folder…"); Flip H/V = kit outline (no shadow). Create Library, Create book (pill) and Cancel widths/x equal the kit within 0.5 px.
- [ ] M71: Settings (from library): top-bar "Library" crumb rgb(57, 55, 56); selected nav row bg rgb(207, 207, 207), 195 px wide; library top-bar "Change library folder…" 24 px tall full pill.
- **Done when:** `e2e/design-r11-controls.spec.ts` green with `--repeat-each=30`; earlier `design-*` specs stay green; full chromium e2e suite and the perf spec green.
- **Browser check:** 1440 × 900: welcome, empty library, Create book ("Lake trip"), Book settings, Cover, Photo inspector with crop mode, Settings from library. Values equal kit steps `welcome`, `library-empty`, `create-book-dialog`, `editor-inspector-book`, `editor-cover-photo-and-title`, `editor-frame-selected`, `settings-from-library`.
- **UI kit:** `uikit/src/components/ui/button.tsx`, `uikit/src/sandbox/inspector.tsx` (:139–158), `uikit/src/sandbox/v7.tsx` (`Field` :132, `SizeEditor` :170, Print :209), `uikit/src/demo-parts/settings.tsx` (:28–43). UI ref: `uikit#/demo`.
- **Source:** Owner rule: every Designer item is a Must; round 11, Designer review r10 2026-11-01 (M68, M70, M71).
