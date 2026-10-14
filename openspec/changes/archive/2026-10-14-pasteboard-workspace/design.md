# Design

## Context

See proposal.md. `PainterFixtureWorkspace` mounts every fixture spread. A normal visit still shows the placeholder. Spread height is always trim height, so at `SPREAD_PX_PER_MM` 0.5 the vertical stride is uniform. The filmstrip already windows from `scrollTop` without reading child layout.

## Goals / Non-Goals

**Goals:** One pasteboard for the session book and the fixture; unmount the far stack; mark the active spread from intersection; containment CSS; scroll perf scenario.

**Non-Goals:** Camera, templates UI, drag, LOD. If the scroll gate fails, stop.

## Decisions

1. **One workspace child.** Delete `PainterFixtureWorkspace`. `EditorShell` always renders `Pasteboard`. `?fixture=painter` still calls `loadPainterFixture()`. The workspace is `display: block` on every visit (`overflow: hidden`, `min-width: 0`). `place-items: center` would shrink the scrollport, so it goes away with the placeholder.

2. **Pure window.** `pasteboardWindow` takes count, stride, `scrollTop`, viewport height, and overscan. Stride is `trimHeightMm * SPREAD_PX_PER_MM + 24`. It returns a half-open index range plus leading and trailing spacer heights covering the viewport plus one stride of overscan. A zero viewport still mounts at least one spread when the book is non-empty. Variable-height prefixes are rejected: every spread shares trim height.

3. **Scroll vs active.** The scroll handler reads `scrollTop` only and coalesces on rAF, as `Filmstrip` does. Viewport height comes from `ResizeObserver`. The active slot is the mounted one with the largest `IntersectionObserver` ratio (`root` = scrollport); ties keep the earlier index. Mark `data-active="true"`. Before the observer reports, the first mounted slot is active. Deriving active from `scrollTop` is rejected; the spec requires intersection.

4. **Slot box.** Each slot wraps `ConnectedSpreadView` with `box-sizing: border-box`, `height` = stride, `padding-bottom: 24px` (the gap, so the border box matches the window), `width: fit-content`, and `margin-inline: auto` (a full-width slot would zero those margins). Also `contain: layout paint style`, `content-visibility: auto`, and `contain-intrinsic-size: auto <stride>px`. E2e reads `data-active` and those containment styles on the slot, not on `SpreadView`. Spacers are empty blocks of the computed height (`min-width: 0`). The scrollport is `data-testid="pasteboard-scroll"`, `role="region"`, `aria-label="Spreads"`, `tabIndex={0}`, with a visible `:focus-visible` ring, and CSS `height: 100%`, `min-height: 0`, `min-width: 0`, `overflow: auto`. `SpreadView` stays presentational.

5. **Perf.** A `frame-budget gates` test opens `/?fixture=painter&perf=1`, throttles, clears, scrolls top to bottom, then `assertNoLoafEntries` and `collectFrameStatsArtifact`. `enablePerfScenario` gains an optional URL (default `/?perf=1`). `pnpm perf` includes that file and the filmstrip spec. Behavior tests reuse `assertDocumentFitsViewport` and `assertNamedScrollport` (`axis: 'vertical'`).

## UI

Empty: one session spread, empty frame, no future-pasteboard sentence. Happy: fixture shows that empty frame and filled previews, mounted count under 40, scroll extent for 40. Scroll: mid-scroll the window covers the port, more remains below, slot `data-active` moves. The scrollport stays a labeled, keyboard-focusable region with a visible focus ring. No page scroll. `ui-review` including layout smoke before push.

## Touch-set

- `src/editor/pasteboardWindow.ts`, `Pasteboard.tsx`, `EditorShell.tsx`, `EditorShell.css`; delete `PainterFixtureWorkspace.tsx`
- `src/editor/pasteboardWindow.test.ts`, `EditorShell.test.tsx`
- `e2e/spread-view.spec.ts`, `e2e/perf/perfFixture.ts`, `package.json` `perf` script
- `scripts/stryker-diff.mjs`, `stryker.config.json`: mutate `src/editor/pasteboardWindow.ts`

## Composition

`pasteboardWindow` is pure. `Pasteboard` owns the scrollport, spacers, slots, and the observer. `ConnectedSpreadView` stays the store edge. `EditorShell` does not compute the window.

## Tests

Public API: `pasteboardWindow` covers the viewport plus overscan and mounts at least one row when count > 0. Fast-check: leading + (end − start) × stride + trailing = count × stride, and the range covers the viewport plus one stride of overscan. `EditorShell`: one spread, no placeholder sentence, labeled focusable region. Playwright: empty visit; fixture scrollport, mid-scroll cover, active and containment on the slot, mounted count < 40; frame-budget scroll.

## Risks / Trade-offs

- [Stride drifts from the slot box] → slot border box is the stride; e2e asserts the window covers the port.
- [Observer lags a fast scroll] → windowing follows `scrollTop`; active updates on the next intersection.
- [Scroll gate fails] → stop and re-plan; no LOD here.

## Migration Plan

No schema or deploy migration. Rollback is revert.
