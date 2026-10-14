# Design

## Context

See proposal.md. `resolveSpread` in `src/core` returns items, crops, and page cuts. `bookStore` notifies the whole store; the filmstrip already uses stable `useSyncExternalStore` snapshots. The workspace in `EditorShell` is a placeholder with `overflow: hidden`.

## Goals / Non-Goals

**Goals:** Presentational painter, per-spread snapshot, 40-spread fixture behind `?fixture=painter`, workspace as a vertical scrollport only in that mode.

**Non-Goals:** Virtualization, camera, real decode, pasteboard perf gate.

## Decisions

1. **Boundaries.** `src/render` paints only. It may import `src/core` types and React. It must not import `editor`, `photo`, or platform modules. `ConnectedSpreadView` in `src/editor` subscribes and passes the cached snapshot through. `EditorShell` chooses placeholder vs fixture list.

2. **Scale and crop.** Fixed `SPREAD_PX_PER_MM` (0.5) until camera exists. A pure `frameBox` maps mm rects to px. A page cut uses `PageCut.orientation`: vertical is a line at x, horizontal at y, both at `offsetMm * scale`. A filled frame is `overflow: hidden`. Against `sourceCropRect` `{x, y, width, height}` the image is `width: (100/width)%`, `height: (100/height)%`, `left: (-100*x/width)%`, `top: (-100*y/height)%`. `decoding="async"`, `alt=""`. The cut line is `aria-hidden`. No preview URL → same placeholder as an empty frame. z-order is CSS `z-index`.

3. **Subscription.** `subscribeSpread(id)` fires when that spread's object identity, index, spread count, or book settings change, or when a placed asset's aspect or preview URL changes. `getSpreadPaintSnapshot(id)` calls `resolveSpread` inside the cache and returns the same object while those inputs are unchanged (lesson: unstable snapshots re-render everyone). The component must not resolve on each render. Import flushes that do not touch a spread do not notify it.

4. **Fixture.** `makePainterFixture()` in `src/core/testing` builds 40 spreads via the existing 4-grid template op, four shared synthetic assets, first frame of spread 0 left empty, and a stable preview-URL map (tiny data URLs, not object URLs). `loadPainterFixture()` writes that book through `resetBookStore`. The query is read in every build, including preview deploys; nothing in the chrome links to it.

5. **Scrollport.** Fixture mode replaces workspace `overflow: hidden` / centering with a named scrollport (`data-testid="spread-fixture-scroll"`). Extend `assertNamedScrollport` with `axis: 'vertical'` (default stays horizontal so filmstrip tests keep working).

## UI

Empty: placeholder block, no `img`. Happy: filled frames show previews; first fixture frame stays empty. Scroll: vertical nudge inside the workspace. Buttons and filmstrip stay as they are. No decorative motion. `ui-review` (including layout smoke) before push.

## Touch-set

- `src/render/frameBox.ts`, `SpreadView.tsx`, `SpreadView.css`
- `src/editor/bookStore.ts`, `ConnectedSpreadView.tsx`, `EditorShell.tsx`, `EditorShell.css`
- `src/core/testing/painterFixture.ts`
- `.dependency-cruiser.cjs` (`render` must not import editor/photo/platform; `core` must not import `render`)
- `scripts/stryker-diff.mjs` and `stryker.config.json` (mutate `src/render/frameBox.ts`)
- `e2e/fixtures/assertDocumentFitsViewport.ts`, `e2e/spread-view.spec.ts`
- `AGENTS.md` module row for `src/render/` → `spread-view`

## Composition

`frameBox` is pure. `SpreadView` is one spread, no store. `ConnectedSpreadView` is the subscription edge. `EditorShell` only switches the workspace child. Fixture construction stays in core testing.

## Tests

Public API: `frameBox`, `SpreadView`, `subscribeSpread` / `getSpreadPaintSnapshot`, `makePainterFixture`, `ConnectedSpreadView`. Reuse `makeBook` where the fixture helper is too heavy. Component: empty vs image, crop box, page cut, sibling does not update. Playwright: `?fixture=painter` empty placeholder + 40 spreads; vertical `assertNamedScrollport` + `assertDocumentFitsViewport`; visit without the query still shows the placeholder.

## Risks / Trade-offs

- [All 40 spreads mounted] → acceptable for this prep; virtualization is the next checkbox.
- [Shared four previews] → enough to paint; unique originals are not required yet.

## Migration Plan

No schema or deploy migration. Rollback is revert.
