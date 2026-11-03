## Decisions

1. M86: `[&_svg]:size-3.5` on the kit Save-as-template Button (prod `<Icon size={14}>`).
2. M87: each Tab wraps label + count in ONE span, without `ml-1`. The Tab stays an inline-flex row, so the inner span is one flex item and its single space is not collapsed.
3. M88, line-height as prod (measured on `#/demo` by overriding the kit element):
   - Layout chips, sort and Add folder… chips: `leading-[normal]` (prod raw buttons).
   - Unplaced: `leading-none` (prod ToggleButton).
   - Empty strip: `text-lg leading-[1.3]` > `text-sm leading-[1.35]` (prod `.pb-empty-title` nesting).
4. Assertions in kit qa (`uikit/scripts/qa.mjs`), numbers not screenshots. Kit tokens only (`text-xs/sm/lg`, `text-muted-foreground`); no new primitives.

## Touch-set & Test Plan

| Path                                      | Why                                  |
| ----------------------------------------- | ------------------------------------ |
| `uikit/src/sandbox/context-inspector.tsx` | M86 icon, M87 tabs, M88 Layout chips |
| `uikit/src/sandbox/chrome.tsx`            | M88 film chips, empty strip          |
| `uikit/src/demo-parts/editor.tsx`         | M88 Add folder… chip                 |
| `uikit/scripts/qa.mjs`                    | M86–M88 assertions                   |

- Reuse: the KS13 qa demo setup and chip helpers.
- Tests: kit qa, numbers per roadmap Done when (±0.5): empty (blank book), happy (photos added, Layout section), interact (Unplaced on, My templates selected). No unit / PBT / prod e2e: no `src/` change.
