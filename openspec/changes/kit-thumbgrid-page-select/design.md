## Decisions

1. `TemplateBar` keys the selection on `basePageId(s.template)` (templates.ts), the rule the inspector picker already uses through `pickerAlias` and prod `LayoutSection` through its alias map; the bar lists unmerged builtins, so no `PICKER_MERGES` alias. On page 1 (`st.cur === 0`) it applies `pageId(id)`, as the inspector's `onPage`, so a click keeps the stored id a page variant.
2. Other `selectedKeys` / `@page` callers already match or hold no template ids; the PR body lists each.
3. `Stack` keeps a `centred` ref: the first effect run that finds the current item (the `ready` remount) scrolls to its centre unconditionally; later runs keep the "not fully in view" rule and the grey-press skip. Masters → Pages swaps the stack for the node view, so the ref resets with the remount.

## Touch-set & Test Plan

| File                                           | Why                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------ |
| `uikit/src/sandbox/chrome.tsx`                 | `TemplateBar` selection key + page-variant apply                               |
| `uikit/src/sandbox/viewport.tsx`               | `Stack` centres on remount                                                     |
| `uikit/scripts/qa.mjs`                         | page-1 tile pressed + `shadow-tile-select`; Masters → Pages scrollTop = centre |
| `docs/roadmap/P2/kit-thumbgrid-page-select.md` | item scope from the brief                                                      |

- Reuse: `basePageId` / `pageId` (templates.ts); qa walk of the r16 M92 block.
- Tests: kit qa (the remount check fails on main: scrollTop 0 vs centre 150 at zoom −6); the unmounted `TemplateBar` edit is covered by typecheck and review only; no kit unit runner, no prod e2e change; `#/demo` pixel diff vs main.
