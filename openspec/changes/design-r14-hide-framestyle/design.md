## Decisions

1. One switch: `export const FRAME_STYLE_AND_ARRANGE_VISIBLE = false` in `src/editor/PhotoFrameSections.tsx`, the default of an optional `styleAndArrange` prop. Hidden means not rendered; unit tests pass the prop to keep the summaries path covered until the roadmap item flips the constant. Section components, summaries, ops and history stay. Dividers need nothing: `.pb-disclosure:not(:last-child)` owns the border.
2. No other entry points: only the two sections dispatch `applyFrameStyle` / `newFrameStyle` / `editFrameStyle` / `reorderFrame`. `[` / `]` toggle panels; `Del` stays on Delete frame.
3. Delete frame takes the kit wrapper (`context-inspector.tsx` `p-4` > `p-3` → one `p-7`) and the kit `destructive-ghost` look via `.frame-delete.pb-button` in `FrameSections.css`: `--destructive` ink, 7 % / 11 % tint on hover / press. App `src/ui` Button has no destructive-ghost variant (docs/design.md), so it stays ghost sm with the semantic role.

## Touch-set & Test Plan

- Files: `src/editor/PhotoFrameSections.tsx`, `src/editor/FrameSections.tsx`, `src/editor/FrameSections.css`; unit `PhotoFrameSections.test.tsx`, `FrameSections.test.tsx`, `Inspector.test.tsx`; e2e new `e2e/design-r14-hide-framestyle.spec.ts`; hidden-state flips in `design-r11-photo`, `design-r10-inspectors`, `design-r9-letter-spacing`, `design-inspector`, `design-inspector-book-cover`, `kit10-inspector-frame-spread`, `inspector-frame-sections` specs.
- Reuse: `Disclosure`, `Button` ghost sm, `--destructive`.
- Tests: unit — default hides both (count 0), order Adjust, Caption, Position & size, Delete; prop on keeps summaries. e2e — count 0 for both sections and "New style from this frame" (filled + empty frame), order and 37 px pitch, Delete frame x 1168 / w 244 / rgb(57, 55, 56) / y = Position & size bottom + 28, every section open scrolls only `inspector-body`.
