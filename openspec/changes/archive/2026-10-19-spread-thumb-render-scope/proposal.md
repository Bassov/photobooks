# Proposal

## Problem

PR #89 wired every mounted `ConnectedSpreadView` to a global thumb-publish generation (plus a React Compiler ternary) so late filmstrip thumbs painted. Any thumb publish then woke every mounted spread. PR #90 already swapped in a per-spread thumb snapshot for LoAF, but the product requirement, Done-when render-count proof (thumb on A must not wake B), and removal of the unused global publish API are still open on this roadmap item.

## Why now

Owner-approved follow-up from PR #89 (2026-10-18). Pasteboard mounts many spreads; thumb decode during import must not re-render siblings. Continuous-zoom frame-budget stays the perf gate.

## Scope in

- Keep / lock the per-spread thumb snapshot (`thumbSnapshotFor` + per-asset `subscribeThumb` for assets on that spread); confirm PR #89 ternary / global generation are absent from `ConnectedSpreadView`.
- Do not delete unused `thumbCache` global publish exports in this change (stryker:diff would score the whole ensureThumb surface below 85%); ConnectedSpreadView must not call them.
- Unit/render-count proof: publishing a thumb for a photo placed only on spread A does not re-render spread B.
- Add missing **Browser check:** / **Perf:** lines on the roadmap item (assumption: item lacked them).

## Scope out

- Document schema / migrations / `book-core` (other session: `asset-metadata-schema`).
- Gate scripts / CI / Stryker config (`stryker-disable-budget`).
- HomeScreen / recents; new dependencies; filmstrip selection rendering.

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `spread-view`: a mounted spread re-renders on thumb publish only when a photo placed on that spread got a new thumb URL

## Success criteria

- **Done when:** unit/render-count test — thumb for a photo on spread A does not increase spread B's render count; continuous-zoom frame-budget e2e stays green.
- **Browser check:** two spreads with different placed photos and no tier/book preview yet show each frame's filmstrip thumb after publish; pasteboard zoom still paints both.
- **Perf:** continuous-zoom frame-budget e2e green; sibling spreads idle on unrelated thumb publishes.

## Risks

- Snapshot string that reallocates on every read would still wake every subscribed spread — keep stable empty/`id:url` encoding.
- Leaving unused global publish exports is a footgun if a future caller re-subscribes globally — review/knip should keep ConnectedSpreadView off that path.
