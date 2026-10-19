# spread-thumb-render-scope

Tag: feature
Milestone: M2.2
Title: ConnectedSpreadView re-renders only when its own spread's thumbnails change
Status: done

## Scope

- [x] Replace the global thumbnail generation subscription in `ConnectedSpreadView` with a per-spread thumbnail snapshot (stable reference unless a photo placed on that spread got a new thumb), following the M1 `selection-render-scope` pattern
- [x] Remove the React-compiler workaround ternary added in PR #89 if the snapshot makes it unnecessary
- **Done when:** a unit/render-count test shows that publishing a thumbnail for a photo on spread A does not re-render spread B; the continuous-zoom frame-budget e2e stays green.
- **Size:** ~200 changed lines
- **Source:** review note PR #89 (owner approved 2026-10-18)

## Done note

Per-spread thumb snapshot and PR #89 ternary removal already on main (PR #90). This change ships the Done-when distinct-asset render-count proof, the spread-view thumb-isolation requirement, and Manual Browser/Perf evidence in tasks.md (item file Scope left unchanged for gate ratchet).
