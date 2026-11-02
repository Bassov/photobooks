## Decisions

1. Drop `FRAME_STYLE_AND_ARRANGE_VISIBLE` and the `styleAndArrange` prop: Frame style and Arrange render unconditionally (pre-#389 shape). Delete frame keeps the #389 inset and ink.
2. Kit parity (DOM dump, kit `#/demo` vs prod, 1440 × 900): rows, chips and Arrange already match. `FrameStyleSection` fixes: "New style from this frame" becomes `Button` `secondary` `sm` with a 14 px `plus`; style sliders take `fit-crop-slider--row`; the uses line takes `fit-crop-note` with a `text-foreground` count; swatches show the frame's cached thumb (`useThumbUrl`, no new decode), grey when empty.
3. Arrange keeps dispatching `reorderFrame` (`src/core/ops/arrange.ts`).
4. Canvas styles stay zero-blur rings (`frameLookCss.ts`). A 40-spread style edit must log zero LoAF; touch the resolve memo only if it fails.

## Touch-set & Test Plan

| File                                                                   | Why                                          |
| ---------------------------------------------------------------------- | -------------------------------------------- |
| `src/editor/PhotoFrameSections.tsx`                                    | (1)                                          |
| `src/editor/FrameLookSections.tsx`                                     | (2)                                          |
| `src/editor/FrameSections.css`                                         | swatch cover                                 |
| `src/editor/PhotoFrameSections.test.tsx`                               | visible order                                |
| `src/editor/Inspector.test.tsx`                                        | visible order                                |
| `src/editor/FrameSections.test.tsx`                                    | visible order                                |
| `src/editor/bookLookUi2.test.tsx`                                      | button, note, swatch                         |
| `e2e/design-r14-hide-framestyle.spec.ts`                               | visible: empty / happy / all-open scrollport |
| `e2e/framestyle-arrange.spec.ts`                                       | style edit, stacking, 40-spread gate         |
| `e2e/design-inspector-book-cover.spec.ts`                              | #389 restore                                 |
| `e2e/design-inspector.spec.ts`                                         | #389 restore                                 |
| `e2e/design-r10-inspectors.spec.ts`                                    | #389 restore                                 |
| `e2e/design-r11-photo.spec.ts`                                         | #389 restore                                 |
| `e2e/design-r9-letter-spacing.spec.ts`                                 | #389 restore                                 |
| `e2e/inspector-frame-sections.spec.ts`                                 | #389 restore                                 |
| `e2e/kit10-inspector-frame-spread.spec.ts`                             | #389 restore                                 |
| `openspec/changes/framestyle-arrange-unhide/specs/spread-view/spec.md` | delta                                        |

Reuse: `Button`, `Icon`, `InspectorSlider`, `fit-crop-*`; tokens per docs/design.md. Skill `ui-review` before push. No gate config edits.
