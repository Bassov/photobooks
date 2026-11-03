## Decisions

1. KS6: drop the Hide inspector IconButton from `InspectorShell` and both `InspectorPanel` headers.
2. KS7 mirrors prod `LayoutPicker`: tabs and chips stay; SearchField, Suggested and "All layouts" go. List sorted by photo count (stable). `templates.ts` `pickerTemplates(single)` drops `t-2port` on two-page spreads; a stored `t-2port` aliases to `t-pair` (pressed tile, header name).
3. Builtin tiles: no caption, `title` = name; custom templates keep caption and menu.
4. Kit `Section` gains `note` ("· name" after the eyebrow, expanded and collapsed); Layout passes the current name.
5. Contact sheet row: two NumberFields (3, 2; 1–6, the `t-cs-CxR` id is one digit per axis) and a secondary `ml-auto` button → `applyTemplate(st, "t-cs-CxR")`.
6. KS12: prod flip glyph paths as local SVG components.
7. KS15: unlayered `select.e7-sel` in `index.css` (beats v7's `.e7-sel`): 16 px chevron SVG, prod `.pb-select` position.
8. Tile h 69.5 is prod's 2:1 trim: pinned on the kit canvas screen (20×20 book); `#/demo` (A5) checks h = 8 + thumb width / trim aspect.

## Touch-set & Test Plan

| File                                      | Reason         |
| ----------------------------------------- | -------------- |
| `uikit/src/sandbox/context-inspector.tsx` | KS6, KS7       |
| `uikit/src/sandbox/templates.ts`          | merge / sort   |
| `uikit/src/sandbox/inspector.tsx`         | KS6, KS12      |
| `uikit/src/components/app/ui.tsx`         | Section `note` |
| `uikit/src/index.css`                     | KS15           |
| `uikit/scripts/qa.mjs`                    | assertions     |

- Demo baselines are not repo files: `demo:baseline` regenerates them into `.cache/agent/` for the PR numbers.
- Kit qa: tile h, cols 2 / 3, builtin captions 0, note, hint, Contact sheet row + click, My templates empty state, Hide count 0, flip paths, chevron 16. `r.search >= 1` is updated in place to `=== 0` (no deletion).
