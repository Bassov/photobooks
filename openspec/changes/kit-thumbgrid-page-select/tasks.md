## Implementation

- [x] 1. `TemplateBar`: select `basePageId(s.template)`, apply `pageId(id)` on page 1 (`uikit/src/sandbox/chrome.tsx`; typecheck + review)
- [x] 2. `Stack`: centre the current spread on the first effect run after mount (`uikit/src/sandbox/viewport.tsx`; qa "Designer r17 … scrollTop = centre", main 0 vs 150)
- [x] 3. Kit qa checks: page-1 tile pressed + `shadow-tile-select`; Masters → Pages scrollTop = centre (`uikit/scripts/qa.mjs`; qa:quick 337/0)

## Manual test scenarios

1. `/uikit/#/demo` editor, page 1 row → apply Hero + two → only its tile ringed.
2. Zoom out 6 steps, pick spread 4–5 (fully in view, not centred), Masters → Pages → 4–5 centred.

Kit-only change: `pnpm agent manual-qa` drives the prod editor, so the scenarios ran as kit qa (Playwright, `#/demo` walk):

- OK 1: pressed tiles = `t-hero2` only; paper box-shadow = `shadow-tile-select` (`… rgb(35, 34, 35) 0px 0px 0px 2px`).
- OK 2: before scrollTop 0 (centre 150); after Masters → Pages scrollTop 150 = centre 150 (main: 0).
- OK ui-review: existing tokens only (`shadow-tile-select`, `bg-sel`), aria-pressed / aria-selected unchanged, no page-level scroll.
