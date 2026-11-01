# design-r12-inspector

Tag: feature
Milestone: P1
Title: Bug: design-r12-inspector: Photo inspector field boxes, Caption offset and Crop "Done" button match the kit
Status: done

## Scope

- [ ] M76: Photo inspector Pan X/Y, X/Y/W/H and Rotation field boxes: radius 8 px and shadow `0 1px 2px rgba(20,20,19,.06)` (kit `MmField` `rounded-md shadow-xs`); Inter 13/400 (M68) and the M72 layout stay. Caption input and hint sit at the kit offsets below the CAPTION title (28.25 / 66.25 px), panel `pt-0.5 pb-3` like every kit `Section`.
- [ ] M77: Crop mode "Done" button (`crop-toggle`, default variant) carries the kit `shadow-xs`; other M70 values unchanged.
- **Done when:** `e2e/design-r12-inspector.spec.ts` green with `--repeat-each=30`; earlier `design-*` specs stay green; full chromium e2e suite and the perf spec green.
- **Browser check:** 1440 × 900: Photo inspector with a selected photo frame (Fit & crop, Geometry, Caption open) and crop mode. Values equal kit steps `editor-frame-selected` and `editor-crop-mode`.
- **UI kit:** `uikit/src/sandbox/inspector.tsx` (`MmField` :24, `CropSection` :126, `CaptionSection` :285), `uikit/src/components/app/ui.tsx` (`Section` :62). UI ref: `uikit#/demo`.
- **Not in scope:** M78 (FRAME STYLE / ARRANGE look) waits on an Owner question.
- **Source:** Owner rule: every Designer item is a Must; round 12, Designer review r11 2026-11-02 (M76, M77).
