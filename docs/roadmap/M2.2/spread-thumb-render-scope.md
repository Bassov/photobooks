# spread-thumb-render-scope

Tag: feature
Milestone: M2.2
Title: ConnectedSpreadView re-renders only when its own spread's thumbnails change

## Scope

- [ ] Replace the global thumbnail generation subscription in `ConnectedSpreadView` with a per-spread thumbnail snapshot (stable reference unless a photo placed on that spread got a new thumb), following the M1 `selection-render-scope` pattern
- [ ] Remove the React-compiler workaround ternary added in PR #89 if the snapshot makes it unnecessary
- **Done when:** a unit/render-count test shows that publishing a thumbnail for a photo on spread A does not re-render spread B; the continuous-zoom frame-budget e2e stays green.
- **Size:** ~200 changed lines
- **Source:** review note PR #89 (owner approved 2026-10-18)
