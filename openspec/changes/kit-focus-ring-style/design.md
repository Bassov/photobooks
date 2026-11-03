## Decisions

1. Cause: Tailwind v4 `outline-hidden` sets `--tw-outline-style: none`; `outline-2` only sets width and reuses that variable, so the ring stays `none`. Fix = add the same-variant `outline-solid` next to each width class (`focus-visible:`, `data-[focus-visible]:`, `focus-within:`, `[&_a:focus-visible]:`), the `site-photographer.tsx:49` pattern. No shared helper: each class string keeps its own colour/offset.
2. Hits (grep `outline-hidden` + outline width without `outline-solid`): `site-viewer.tsx` :16, :17, :42, :53, :64, :74, :103, :111; `library.tsx` :124, :127, :137; `components/ui/slider.tsx` :120; `kit/Credits.tsx` :7; `kit/Shell.tsx` :143. v4 `outline-none` compiles the same (`--tw-outline-style:none`): `create-book.tsx` :33, `sandbox/v7.tsx` :145, :175, :212. `ring-*` focus styles are box-shadow and out of scope.
3. Text inputs match `:focus-visible` on click (browser rule); expected.
4. qa `tabRings` names a control by `data-testid`, else `aria-label`; for an `<input>` inside a `<label>` it measures the label (library search draws its ring there). Site title button gets `data-testid="site-title-link"`.

## Touch-set & Test Plan

| File                                 | Why                                |
| ------------------------------------ | ---------------------------------- |
| `uikit/src/features/site-viewer.tsx` | add `outline-solid`; title test id |
| `uikit/src/features/library.tsx`     | add `outline-solid`                |
| `uikit/src/components/ui/slider.tsx` | add `outline-solid`                |
| `uikit/src/kit/Credits.tsx`          | add `outline-solid`                |
| `uikit/src/kit/Shell.tsx`            | add `outline-solid`                |
| `uikit/src/features/create-book.tsx` | add `outline-solid`                |
| `uikit/src/sandbox/v7.tsx`           | add `outline-solid`                |
| `uikit/scripts/qa.mjs`               | extend focus check                 |

- Reuse: `tabRings`, `smoke`.
- Tests: kit qa smoke `site-viewer` (catalog → book → Fullscreen controls solid 2 px; mouse click on Next spread → not solid) and `recents-home` (search + sort solid 2 px). Credits / Shell / slider: one-off DOM measure. `#/demo` baselines must stay unchanged; PR lists each hit. No prod e2e.
