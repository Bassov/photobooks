# Proposal

## Problem

With a long gallery the virtualized filmstrip spacer grows wider than the viewport, but CSS Grid `min-width: auto` lets that min-content stretch the whole editor shell. The page gains horizontal (and often vertical) scrollbars; the filmstrip’s own `overflow-x: auto` never becomes the scrollport.

## Why now

Exploratory bug on the editor-shell filmstrip: bulk import makes the document wider than the screen. Must lock in Playwright before the next pasteboard work builds on this shell.

## Scope in

- Viewport-locked editor shell (no page-level horizontal or vertical scroll)
- Filmstrip containment so only `.filmstrip-scroll` scrolls horizontally for long galleries
- Vitest unit/integration coverage of spacer + shell overflow styles
- Playwright regression that would fail on the current layout

## Scope out

- Virtualizer / spacer math changes in TS
- Filmstrip sort/filter/height (`filmstrip-management`)
- Pasteboard / drag / camera work

## Capabilities

### Modified Capabilities

- `editor-shell`: shell fills the viewport without document overflow; long galleries scroll only inside the filmstrip

## Success criteria

- After importing many photos, `documentElement` is not wider or taller than the viewport
- `[data-testid=filmstrip-scroll]` has `scrollWidth > clientWidth` and accepts `scrollLeft`
- Unit/component tests lock spacer width and shell/filmstrip overflow containment styles
- Playwright e2e fails before the CSS fix and passes after

## Risks

- Over-aggressive `overflow: hidden` on the shell could clip future chrome (errors/progress) if content grows; keep chrome in the fixed grid and only clip page overflow
