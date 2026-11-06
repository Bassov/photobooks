## Decisions

1. One shared `.editor-workspace, .cover-stage` rule in `src/editor/EditorShell.css` carries the pasteboard background (`--canvas` + the `--dot` 16 px gradient, tokens from `docs/design.md`); `.cover-stage` drops its `background: var(--canvas)` shorthand, which would reset the image. It fixes all callers: `CoverView` (cover), `EndpaperCanvas` (endpaper), `MastersCanvas` (masters); none overrides the stage background.
2. Phase: `.cover-stage` is `absolute; inset: 0` over the workspace area, so the same `background-position` gives the same dot phase. The e2e checks it from paint.
3. `background-color` keeps the stage opaque; the spreads beneath stay hidden.

## Touch-set & Test Plan

| Path                              | Why                                      |
| --------------------------------- | ---------------------------------------- |
| `src/editor/EditorShell.css`      | shared pasteboard background rule        |
| `src/render/CoverView.css`        | drop the flat stage background           |
| `src/editor/EditorShell.test.tsx` | CSS assertion follows the shared rule    |
| `e2e/cover-stage-dots.spec.ts`    | paint probe on the three stages + spread |

- Reuse: `e2e/fixtures/paintProbe.ts` `pixelsAt`, `openSessionEditor`.
- Tests: unit regex on the shared selector; e2e at 1440×900: one 16×16 px block beside the sheet, same page spot, reads the same pixels on spread, cover, endpaper and masters (dots ≥ 225, same phase, opaque). Geometry stays locked by `e2e/cover-editor.spec.ts` (sheet 848 px). Skill `ui-review` before push.
