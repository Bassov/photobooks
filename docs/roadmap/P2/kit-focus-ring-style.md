# kit-focus-ring-style

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item kit-focus-ring-style

## Scope

- [ ] Kit focus ring visible: every `uikit/src` class that pairs `outline-hidden` with a focus outline width (`focus-visible:outline-2`, `data-[focus-visible]:outline-2`, `focus-within:outline-2`, `[&_a:focus-visible]:outline-2`) but no matching `outline-solid` gets the `outline-solid` of the same variant, as in `uikit/src/features/site-photographer.tsx:49` (`const focus`). Known hits: `site-viewer.tsx` `quietBtn` / `quietIcon` and the other site controls, `library.tsx` `quiet` (search + sort). Ring colours and offsets unchanged; no new tokens; no prod (`src/`) change.
- [ ] `uikit/scripts/qa.mjs`: the check "focus-visible outline solid on every control" (`site-photographer`) also covers the `site-viewer` page and the library bar (Tab → computed `outline-style: solid`, `outline-width: 2px`), and a mouse click on a quiet button draws no ring.
- **Done when:** Tab focus on every fixed control measures `outline-style: solid` and `outline-width: 2px` (DOM-measured, numbers in the PR body); a mouse click on a button shows no ring (text inputs keep the browser's focus-visible rule); `#/demo` baselines unchanged; kit qa green incl. the extended check; `pnpm uikit:typecheck` and unit green. The PR body lists each grep hit as fixed or left out with a reason.
- **Browser check:** `uikit/dist/index.html?theme=procreate-light#/feature/site-viewer` at 1440 × 900: Tab to a book, then on the book page to Share / Fullscreen / Next spread → a 2 px solid #535152 ring; click Share with the mouse → no ring. `#/feature/recents-home`: Tab to Search and Sort → 2 px solid #3A3839 ring.
- **UI kit:** `uikit/src/features/site-viewer.tsx`, `uikit/src/features/library.tsx`, other `uikit/src` grep hits, `uikit/scripts/qa.mjs`. UI ref: `uikit#/feature/site-viewer`.
- **Source:** Designer review of #432 (site-photographer-demo, 2026-11-03 23:47 / 00:28).
