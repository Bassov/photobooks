# Proposal

## Problem

`resolveSpread` already produces painter-ready items, but the workspace is still a placeholder. Editor, site, and later thumbnails have no shared DOM painter, so the pasteboard cannot start.

## Why now

Next M1 checkbox in `docs/roadmap.md` after `editor-shell-filmstrip`. `pasteboard-workspace` needs a painted spread, a per-spread subscription, and a ~40×4 fixture before it can gate scroll.

## Scope in

- Paint one resolved spread: frames from millimeter rects at a fixed screen scale, a page-cut line, an empty-frame placeholder, and a filled frame as an asynchronously decoded preview from a caller-supplied URL
- Subscribe per spread so an edit re-renders only that spread
- Fixture book of about 40 spreads × 4 frames on the 4-grid template, with synthetic previews and the first frame of the first spread empty
- `?fixture=painter` loads that book into the workspace as a named vertical scrollport, with no virtualization
- A normal visit keeps the existing workspace placeholder

## Scope out

- Pasteboard virtualization, `contain` / `content-visibility`, active-spread tracking, and the book-scroll perf gate (`pasteboard-workspace`)
- Camera zoom and pan, zoom image tiers, drag place and replace
- Persistence and decoding real photos into frames

## Capabilities

### New Capabilities

- `spread-view`: shared DOM painter for one resolved spread, per-spread subscription, and the query-loaded painter fixture

### Modified Capabilities

- None. Default editor-shell behavior stays the placeholder workspace and filmstrip.

## Success criteria

- An empty frame shows a placeholder and no image; a filled frame shows a preview image
- An interior spread shows a page-cut line; frames follow resolved millimeter positions
- Editing one spread re-renders that spread only
- With `?fixture=painter`, about 40 spreads are painted, the empty placeholder is visible, and the user can scroll the stack
- No page-level horizontal or vertical scroll; fixture scrolling happens only inside the workspace scrollport
- A normal visit still shows the workspace placeholder, not the fixture

## Risks

- Drawing all ~40 spreads without virtualization can be heavy; the scroll perf gate stays on `pasteboard-workspace`
- An unstable per-spread snapshot would re-render every spread on any store update
