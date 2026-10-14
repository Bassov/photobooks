# Proposal

## Problem

A normal visit still shows a workspace placeholder, and `?fixture=painter` mounts every spread at once. There is no pasteboard scroll, and nothing to gate at 60 fps.

## Why now

Next M1 checkbox in `docs/roadmap.md` after `spread-view-painter`. The painter and the ~40×4 fixture already exist.

## Scope in

- One pasteboard: all book spreads stacked vertically, centered, with a gap
- Off-screen spreads stay unmounted; the mounted window covers the scrollport plus overscan
- Each mounted spread uses `contain` and `content-visibility` with an intrinsic size
- The active spread follows scroll via `IntersectionObserver` (no layout reads in the scroll handler) and is marked on that spread
- A normal visit paints the session book's one empty-frame spread; the placeholder sentence goes away
- `?fixture=painter` still loads the 40-spread book; only the near-viewport window is mounted

## Scope out

- Camera zoom and pan, zoom image tiers, and the far-zoom LOD fallback
- Choosing templates, adding spreads, drag place/replace, spread list, rulers, guides

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `spread-view`: replace the always-mounted fixture stack and the default placeholder with a virtualized pasteboard and an active spread
- `editor-shell`: the workspace is the pasteboard scrollport, not a placeholder
- `frame-budget`: add the fixture pasteboard scroll scenario to the CI LoAF gate and `pnpm perf`

## Success criteria

- Empty: a normal visit shows one spread whose first frame is an empty placeholder, the old placeholder sentence is gone, and the document does not grow page scrollbars
- Happy path: with `?fixture=painter`, painted frames and the first empty frame are visible, the stack's scroll extent represents all ~40 spreads, and fewer than 40 spreads are mounted
- Scroll: the pasteboard is the only vertical scrollport; mid-scroll the mounted window covers the port while more spreads remain below; the marked active spread changes; no page-level horizontal or vertical scroll
- Scrolling the fixture from top to bottom records zero LoAF; `pnpm perf` fails that scenario when frame pacing is outside budget

## Risks

- A stride that does not match painted height leaves mid-scroll holes
- A wrong `content-visibility` intrinsic size can collapse the scroll extent or hide the active spread
- If the scroll gate fails, stop and re-plan; do not pull LOD into this change
