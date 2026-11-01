## Decisions

1. Field boxes: `.fit-crop-field` (used only by the inspector Pan X/Y and Geometry `MmField`) moves from `--radius-sm` to `--radius-md` and gains `box-shadow: var(--shadow-xs)`, the kit `MmField` `rounded-md shadow-xs`; disabled boxes keep the shadow at reduced opacity, as the kit `data-[disabled]:opacity-60` does. Shared `src/ui/Field` is not touched (not used by these boxes).
2. Caption: the panel padding goes from `px-4 pb-4` to the kit `Section` panel `px-4 pt-0.5 pb-3` (the other photo sections already use it). This moves the input and hint 2 px down to the kit offsets.
3. Done: `crop-toggle` gets a scoped `.fit-crop-toggle` class with `box-shadow: var(--shadow-xs)`, so the `default` (Done) state carries the kit `shadow-xs` like the `secondary` (Crop) state. `Button.css` `default` stays shadowless for other uses.
4. Tokens: `--radius-md`, `--shadow-xs` from `docs/design.md`; no new tokens.

## Touch-set & Test Plan

- Files: `src/editor/FitCropSection.css`, `src/editor/FitCropSection.tsx`, `src/editor/FrameLookSections.tsx`, `e2e/design-r12-inspector.spec.ts` (new), unit tests in `src/editor/Inspector.test.tsx` / `bookLookUi.test.tsx`.
- Reuse: existing e2e fixtures / helpers from `e2e/design-r11-photo.spec.ts`.
- Tests: unit pins the class hooks (crop toggle class in both states, caption panel padding); e2e asserts radius/shadow exact and Caption dy within 0.5 px vs kit values in the spec header, plus the Done shadow after Crop. Skill `ui-review` before push.
