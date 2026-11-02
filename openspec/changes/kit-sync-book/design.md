## Decisions

1. Cover selects: one local `CoverSel` in `v7.tsx` mirroring prod `Select` (`src/ui/Select.tsx` + `Field.css` `.pb-select`): native `<select>`, h 36 (`h-9`), radius `rounded-md`, bg `FIELD` (#D7D7D7), lucide-style chevron-down 16 px via a new `.e7-csel` rule in `V7CSS` (no `index.css`). Kit gates ban borders and arbitrary padding utilities, so prod's 1 px same-colour border is folded into the rule's padding (11 / 33 px) and chevron offset (9 px): pixel-identical box. Width = content, so the right edge lands on the inspector content edge (1424). Options copied from prod `coverOptions.ts`; local `useState`, so Cover is editable (no "coming later").
2. Read-only pills: `Val` + note wrapped in one `flex items-center` span (prod `ReadOnlyPill`), so `Row`'s `justify-between` right-aligns the pair (Paper white, Binding Hardcover).
3. Pastedown caption: delete the span in `EndpaperSpread`.
4. Library card title: demo library passes `ink: "#F5F5F5"` to `BookTile` (shared `features/library.tsx` default untouched — the static library page keeps its per-book inks).

## Touch-set & Test Plan

| Path                               | Why                                                       |
| ---------------------------------- | --------------------------------------------------------- |
| `uikit/src/sandbox/v7.tsx`         | KS9 caption, KS10 selects + pill wrappers                 |
| `uikit/src/demo-parts/library.tsx` | KS11 card ink                                             |
| `uikit/scripts/qa.mjs`             | pin row tops, select box, pill x, no caption, card colour |

- Reuse: `Row`, `Sec`, `Val`, `FIELD`/`T`/`SUB` tokens (docs/design.md field fill).
- Tests: kit qa smoke on `#/demo` (cover selected: row tops ±1, select h/radius/bg/right edge, change Cover; endpaper: no "Pastedown" text; library: card title colour). No `src/` → no unit/e2e/stryker delta. Demo baselines regenerated via `demo:baseline` into `.cache/agent/`.
