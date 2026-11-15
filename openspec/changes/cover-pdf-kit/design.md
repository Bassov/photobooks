## Decisions

1. **Cover geometry = the kit canvas:** sheet `coverW + 2·WRAP` × `h + 2·WRAP`, spine `spineCm(pages)` (v7.tsx). A `cover` prop on `PrintDialog` seeds a manual spine, spine text and ppi for `Cover check` only.
2. **Cover rows are pure:** `coverCheckRows` in `printCheck.ts`; `CheckRow.scope: 'pages' | 'cover'`; sort = severity, scope, rule order. Generic `minFontPt` 6 and cover bleed = page bleed are kit constants (like `KIT_COLOR`). Booklets filter cover rows before the label, list and note.
3. **Spine advance** is measured in the dialog (2D canvas, `--font-heading` italic, the canvas spine face) and passed in.
4. **Run:** units sheets + 1, `Cover · p%` on the last; done cover file = `…-cover.pdf`; `pageList` puts `cover` first.
5. **UI:** the Cover row reuses the Page size row (`flex justify-between text-sm`, muted label, `tabular-nums`); done line = `print-done` style; Open cover = the Open PDF ghost button. Skill `ui-review` before push.

## Touch-set & Test Plan

| File                                 | Why                         |
| ------------------------------------ | --------------------------- |
| `uikit/src/demo-parts/printCheck.ts` | texts, progress, cover rows |
| `uikit/src/demo-parts/dialogs.tsx`   | Cover row, run, done        |
| `uikit/src/features/pages.tsx`       | `Cover check` scenario      |
| `uikit/src/sandbox/v7.tsx`           | spine #3E3C3B               |
| `e2e/kit-pdf-export.spec.ts`         | kit checks                  |
| `docs/roadmap/P4/cover-pdf-kit.md`   | item scope                  |

- `uikit/scripts/demo-capture.mjs`: no change (steps already shoot the dialog).
- `e2e/kit10-cover.spec.ts`: no change; it drives the prod editor, whose spine moves in item `cover-pdf`. The kit spine colour is checked on `#/full/cover-editor` in `kit-pdf-export.spec.ts`.
- Tests: e2e only (no uikit vitest lane): happy (Cover row, done two files), empty (no cover rows with 2-up; front without photo → info), interact (imposition switch keeps rows in place, paint probe).
