# design-r10-chrome

Tag: feature
Milestone: P1
Title: Bug: design-r10-chrome: button font, layout picker and Create dialog match the kit

## Scope

- [ ] M58: no `<button>` renders in the browser default font (Arial 13.33 px) on the walked editor steps, library, settings and Create book dialog. Pages/Masters toggle (Inter 13 / 500, 92 × 26 segments flush in a 2 px track), spread-list labels (Inter), filmstrip "Add folder…" (Inter 12 / 500, rgb(57, 55, 56)) and the Settings nav "Library" (Inter 13 / 500, rgb(57, 55, 56)) match kit `#/demo` at 1440 × 900.
- [ ] M62: layout picker colours match the kit: unselected "My templates" tab rgb(83, 81, 82), selected tab rgb(57, 55, 56); tile captions rgb(57, 55, 56) / 400 while the pointer is over the Layout section (kit `group-hover` on the Section), muted at rest. Steps `editor-new-blank-book` and `editor-spread-1`.
- [ ] M63: Create book dialog matches the kit: title, labels, Orientation, hint and the Custom size select row within 0.5 px; size-menu rows 30.84 px pitch; Cancel rgb(57, 55, 56).
- **Done when:** `e2e/design-r10-chrome.spec.ts` green with `--repeat-each=30`; r4 M40/M41, r7 M45/M46 and r8 specs stay green; full chromium e2e suite and the perf spec green.
- **Browser check:** 1440 × 900: open Create book (title "Lake trip"), open the size menu, pick Custom size 19 × 23; create; hover the Layout section; open Settings. Values equal kit steps `create-book-dialog`, `create-book-size-menu`, `create-book-custom-size`, `editor-new-blank-book`, `editor-spread-1`, `settings-from-library`.
- **UI kit:** `uikit/src/features/create-book.tsx`, `uikit/src/components/ui/select.tsx`, `uikit/src/sandbox/v7.tsx` (`SegC` :138), `uikit/src/sandbox/context-inspector.tsx` (`TemplateTile` :100), `uikit/src/demo-parts/editor.tsx` (Add folder :75). UI ref: `uikit#/demo`.
- **Source:** Owner Must relayed by the Designer, round 10, Designer review r9 2026-11-01 (M58, M62, M63).
