# site-photographer-demo

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item site-photographer-demo
Status: done

## Scope

- [x] New kit page `site-photographer` (`#/full/site-photographer`, `#/feature/site-photographer`): a photographer's site of books — home (masthead, lead, a two-row shelf of six sample books, About, footer), one page per book (text, facts, Read in fullscreen, Share, closed book, every spread drawn from the kit layout templates, Next book) and the kit Fullscreen viewer at the book's own ratio. Six books, texts and spreads as in the Designer Spec `photographer-site-demo-v2` (Owner Q-8, 2026-11-03).
- [x] `site-viewer.tsx` exports `Fullscreen` with an optional `ratio` (default `SW / SH`); existing callers unchanged. Manifest row after `site-lightbox`; kit qa smoke `site-photographer` (book → `ps-title` "Lake trip" → spread → `lightbox`, indicator "Pages 2–3…").
- **Done when:** at 1440 × 900 (±1 px, DOM-measured, values relative to `ps-site` at scrollTop 0): home has 6 cards in order lake-trip, coast, summer-family, desert-road, forest, city with lefts 160 / 544 / 928, shelf top 261.8, row-2 top 741.9, About 1246.1, scrollHeight 1485; Lake trip shows 10 spreads 1040 × 650, first at 771, Next book at 8255, scrollHeight 8530; spread 3 opens Fullscreen "Pages 6–7 · 6 / 22", book width 1337.6; Share shows "Link copied" and `https://aleksandr.photos/lake-trip`; 390 px = one column, kit frame 1116 = 2 columns of 494. Kit qa (incl. the new check), `pnpm uikit:typecheck` and `pnpm uikit:build` green; `#/demo` `site-*` steps unchanged. The PR body lists the numbers and says a Designer review follows.
- **Browser check:** `uikit/dist/index.html?theme=procreate-light#/full/site-photographer` at 1440 × 900: two shelf rows (the second starts in the first screen), click Lake trip → full-bleed first spread under the hero, click a spread → Fullscreen at that spread, Esc returns focus to it; Share prints the link.
- **UI kit:** new `uikit/src/features/site-photographer.tsx`; `uikit/src/features/site-viewer.tsx` (Fullscreen :89–101), `uikit/src/features/pages.tsx` (after `site-lightbox`), `uikit/src/kit/pages.json`, `uikit/scripts/qa.mjs` (after the `site-viewer` smoke). UI ref: `uikit#/feature/site-photographer`. No prod (`src/`) change; no new tokens.
- **Source:** Designer Spec `photographer-site-demo-v2` (READY, 2026-11-03; replaces v1). Owner Q-8: "Вариант 2 решите сами, нужна демо страница в ките".
