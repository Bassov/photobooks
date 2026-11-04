## Decisions

1. Cause: the runtime rule in `editorChromeTokens.ts` puts the kit card (radius, `--spread-card-shadow`, clip) on the row-wide box `.editor-spread-thumb` and beats `SpreadsPanel.css` `box-shadow: none`; on trims narrower than 1.6:1 the paper is centred and the box shadow outlines grey margins beside it (numbers in the PR).
2. The rule targets the paper instead: `.editor-spread-thumb > .spread-view--thumb`. The direct child exists only for two-page spreads and masters (`SpreadThumb` `side = null`); single pages sit inside `.spread-thumb-slot`, so their `SpreadsPanel.css` rules are untouched. Existing tokens `--spread-card-shadow` / `--spread-card-radius`; none added.
3. `SpreadsPanel.tsx` and `MastersPanel.tsx` are the only `SpreadThumb` users; both get the fix.

## Touch-set & Test Plan

| File                                    | Why                                             |
| --------------------------------------- | ----------------------------------------------- |
| `src/editor/editorChromeTokens.ts`      | card rule moves box → paper                     |
| `src/editor/editorChromeTokens.test.ts` | rule text locks the paper selector              |
| `src/editor/SpreadsPanel.css`           | drop the dead single-page box override; comment |
| `e2e/spread-thumb-backing.spec.ts`      | new: narrow-trim two-page and master rows       |
| `e2e/design-r12-surfaces.spec.ts`       | M79 card values read from the paper             |

- Reuse: `openLibraryBook`, `addSpreads` fixtures.
- Unit: chrome CSS rule (red first). e2e: 15 × 21 cm book, box vs paper styles and a pixel beside the paper; fails on main.
