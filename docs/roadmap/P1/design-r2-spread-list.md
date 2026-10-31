# design-r2-spread-list

Tag: feature
Milestone: P1
Title: Bug: design-r2-spread-list - spread-list panel parity (M17-M19, M23, M24)

## Scope

- [x] M17: no "+ Add spread" button in the spread list; adding stays on the row "…" menu (Add after) and Ctrl/Cmd+Enter.
- [x] M18: Cover and Endpaper rows scroll inside `spreads-list` with the pages (back Endpaper after the last page); still not reorderable, not `[data-item]`.
- [x] M19: Cover / Endpaper rows use the kit card (`max(ratio,1.6)` box, ratio-sized inner, label row).
- [x] M23: pasteboard stack gap is 44 screen px across the kit zoom range (spread bottom → next top; half the spread below an 88 px spread so whole-book fit still works), labels 6 px under the spread inside the gap.
- [x] M24: the page number under a single page (page 1, single last page) is centred under that page.
- **Done when:** `e2e/design-r2-spread-list.spec.ts` green with `--repeat-each=30`; spread-reorder.spec.ts green.
- **Browser check:** 1440×900: scroll the spread list — Cover / Endpaper scroll away; no Add spread button; canvas gap ≈ kit; page 1 label centred.
- **UI kit:** `uikit/src/sandbox/chrome.tsx` (SpreadsPanel ThumbGrid list :266-322), `uikit/src/sandbox/viewport.tsx` (Viewport `stackGap` :111, stack :319). UI ref: uikit#/demo.
