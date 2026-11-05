## Decisions

1. Prod Fill row = `<span data-testid="fill-readonly" class="inline-flex items-center gap-1.5 py-1">` holding a `size-3 rounded-2xs shadow-hairline` swatch (`fill-swatch`, `aria-hidden`, inline `background: style.backFill`) and `style.backFill.toUpperCase()`. Tokens: `--radius-2xs`, `--shadow-hairline` (`styles/tokens.css` `@theme`). Reads the existing `useStyle()` store hook; no new state. The `cover-back-fill` pill test id goes away.
2. `py-1` keeps the row as tall as the old `Val` pill, so kit QA KS10 row tops (`uikit/scripts/qa.mjs:2145`) and prod row tops stay unchanged.
3. Kit `v7.tsx:277` row: the same span with the kit's back colour `#3E3C3B` (`v7.tsx:72`); `ReadOnly` stays (Binding uses it).
4. Lane deviation: `qa.mjs` KS10 "Paper white x 1272.72" lookup (2157/2161) must follow the kit row; only that lookup changes. Noted in the PR.

## Touch-set & Test Plan

| Path                                      | Why                                       |
| ----------------------------------------- | ----------------------------------------- |
| `src/editor/CoverSection.tsx`             | Fill row swatch + hex                     |
| `src/editor/CoverParity.test.tsx`         | default `#3E3C3B`; `#112233` hex + swatch |
| `uikit/src/sandbox/v7.tsx`                | kit Back Fill row                         |
| `uikit/scripts/qa.mjs`                    | KS10 lookup follows the kit row (D4)      |
| `e2e/design-r2-cover-book.spec.ts`        | M6: visible Fill row on `?fixture=`       |
| `e2e/design-filmstrip-cover.spec.ts`      | drop old Fill text / "coming later" count |
| `e2e/design-inspector-book-cover.spec.ts` | drop old `cover-back-fill` text           |

- Reuse: `InspectorRow`, `useStyle()`, kit `Row`.
- Tests: unit (CoverParity: default + custom `backFill`, swatch colour, no "coming later"); e2e M6 extended (row text `#3E3C3B`, swatch visible). Skill `ui-review` before push.
