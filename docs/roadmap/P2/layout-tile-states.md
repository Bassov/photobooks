# layout-tile-states

Tag: feature
Milestone: P2
Title: Layout tiles: hover/selected on the paper, thumb box follows the trim
Status: done

## Scope

Owner design decision (INBOX 2026-11-02, approved mockup): an Owner-approved deviation from the kit for the inspector
Layout section tiles. Files: `src/editor/LayoutSection.tsx`, `LayoutSection.css`, `layoutThumb.ts` (+ tests),
one shadow token in `styles/tokens.css`.

- [ ] `.layout-tile` stays transparent on hover / selected; state is drawn on `.layout-thumb-paper`: hover
      `0 0 0 1px rgb(0 0 0 / .22), 0 2px 6px rgb(0 0 0 / .12)` + `translateY(-1px)`; selected `0 0 0 2px var(--select)`,
      no transform; focus-visible `0 0 0 2px var(--background), 0 0 0 4px var(--ring)` on the paper only;
      `transition: box-shadow, transform var(--motion-duration-fast)`. Caption rules unchanged.
- [ ] `.layout-thumb` aspect-ratio = clamp(2/3, trim w/h, 2/1); `thumbPaperBox` fills that box (no side areas).
- [ ] Single-page trims (ratio < 1.2): 3 columns (gap-1.5); spreads keep 2 columns.
- [ ] Full-bleed thumbs stay readable via the ring (no grey-on-grey).
- **Browser check:** 1440×900 fixture: page 1 (single page) shows 3 columns, paper width = thumb box width ±1 px;
  spread 2–3 shows 2 columns, unchanged 123×61.5 thumbs; hover / selected / keyboard focus rings on the paper.

## Done when

1. Single-page trim: 3 columns; paper width = thumb box width ±1px. Spread: 2 columns, unchanged size.
2. Hover: tile background transparent, paper box-shadow as spec, translateY(-1px). Selected: 2px `--select` ring, no
   transform. Keyboard focus shows the gapped ring on the paper only.
3. Unit + affected e2e green; full e2e once at the end; stryker-diff green.
4. PR body: before/after DOM numbers (tile bg, paper box, column count) for one single-page and one spread trim.

Out: `#/demo`, `uikit/`, painter / fixtures, FrameSections / frameArrange (arrange-lock lane).
