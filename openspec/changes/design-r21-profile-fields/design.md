## Decisions

1. M97: prod has no preflight, so a `<button>` keeps the UA fill rgb(239). Add `bg-transparent` to the nav row base class; `cn()` (twMerge) drops it for the current row's `bg-accent`, and `hover:` / `focus-visible:bg-[#D7D7D7]` still win as variants.
2. M98: the input already asks for `font-mono`, but `INPUT`'s `[font:inherit]` shorthand is emitted later and resets the family to Inter. Use `font-mono!` on the number input only; size still inherits the box `text-sm` (13 px), as the kit's preflight-inherited input does. The Name input keeps Inter.

## Touch-set & Test Plan

| Path                                  | Why                                                 |
| ------------------------------------- | --------------------------------------------------- |
| `src/editor/SettingsScreen.tsx`       | M97 `bg-transparent`                                |
| `src/editor/PrintProfileDialog.tsx`   | M98 `font-mono!` in `field()`                       |
| `src/editor/SettingsScreen.test.tsx`  | rest row has `bg-transparent`, current row does not |
| `e2e/settings-profile-fields.spec.ts` | paint checks (new spec, lane note)                  |

- Reuse: `e2e/fixtures/paintProbe.ts` `pixelsAt`.
- e2e: Library row pixel = rgb(225) at rest, rgb(215) on hover; all 13 `field()` inputs compute `ui-monospace…` 13 px. Tokens: `bg-accent`, `bg-chrome`, `font-mono` (docs/design.md), unchanged.
