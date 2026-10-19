# spread-thumb-render-scope

Tag: feature
Milestone: M2.2
Title: ConnectedSpreadView re-renders only when its own spread's thumbnails change
Status: done

## Scope

- [x] Replace the global thumbnail generation subscription in `ConnectedSpreadView` with a per-spread thumbnail snapshot (stable reference unless a photo placed on that spread got a new thumb), following the M1 `selection-render-scope` pattern
- [x] Remove the React-compiler workaround ternary added in PR #89 if the snapshot makes it unnecessary
- **Done when:** a unit/render-count test shows that publishing a thumbnail for a photo on spread A does not re-render spread B; the continuous-zoom frame-budget e2e stays green.
- **Perf:** continuous-zoom frame-budget e2e stays green; sibling spreads idle when a thumb publishes for a photo on another spread only.
- **Browser check:** two spreads with different placed photos and no tier/book preview yet each show their filmstrip thumb after publish; pasteboard zoom still paints both spreads.
- **Size:** ~200 changed lines
- **Source:** review note PR #89 (owner approved 2026-10-18)

## Done note

Per-spread thumb snapshot already on main (PR #90); this change locks the Done-when render-count proof (distinct photos A/B), spread-view spec, Browser/Perf lines. Left unused thumbCache global publish exports (deleting them fails stryker:diff 85% on ensureThumb).
