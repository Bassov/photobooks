# Design

## Context

See proposal.md — Problem. Roadmap "How to use" says one checkbox = one change, without a size. Config design rules want a touch-set "sized for one apply context", undefined. The proposal reviewer's narrowness check is generic.

## Goals / Non-Goals

**Goals:** a budget checkable at propose time; every not-yet-started item outside M8 fits it.

**Non-Goals:** CI enforcement; re-slicing `editor-shell-filmstrip` (in flight) or M8 (re-plan note).

## Decisions

### Subsystem

A unit with its own lifecycle or contract: worker / worker pool, store, painter / render layer, storage or cache adapter, new dependency, new Vite entry, schema version bump, new top-level UI region (screen, panel, overlay layer). A UI region with its own view state is one subsystem; a dependency or worker that exists only to implement the item's one subsystem counts with it. Not counted: new job types on the existing pool, ops / selectors / slices on an existing store, wiring existing subsystems into UI, the change's own perf scenario.

Alternative: count files. Rejected — rewards god-files.

### Single source for numbers

Limits (1 subsystem, ≤ 8 implementation tasks, ~1000 lines guideline) and split-before-apply live only in `openspec/config.yaml` `rules.proposal` / `rules.tasks`. Roadmap "How to use" holds the subsystem definition and slicing rules and points to config for the numbers. The proposal reviewer's narrowness check names `rules.proposal`. No new alwaysApply rule.

### ADDED requirement, not MODIFIED `Product roadmap`

Sizing is a separate behavior; the existing block stays intact.

### Slicing rules

1. A `[feature]` adds at most one subsystem; if it needs both non-UI infrastructure and a new UI region, the infrastructure is a preceding `[prep]`.
2. A book schema bump is its own `[prep]`; pure functions over the new fields may ride along.
3. Gate fallbacks with their own scope are `[contingency]` items; stop-and-re-plan conditions and in-place choices stay inline. When the gate-owning change archives with the gate green, tick the contingency as "not needed" together with it.
4. Each split `[feature]` keeps its own **Browser check:**, plus **Perf:** when it adds an interaction or background work.
5. Split only for a subsystem or the 8-task limit.
6. The item owning a gate keeps its name (`pasteboard-workspace`, `camera-zoom-pan`, `pdf-export`) so architecture references stay valid.

### Re-slice map

Unlisted unchecked items stay as they are.

| Original                   | New items (tag — added subsystem / reason)                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pasteboard-workspace`     | `spread-view-painter` (prep — painter, fixture book); `pasteboard-workspace` (pasteboard region, painter gate); `spread-templates-ui` (spread toolbar region) |
| `camera-zoom-pan`          | `camera-zoom-pan` (camera, gate); `zoom-image-tiers` (tier cache); `far-zoom-lod` (contingency)                                                               |
| `drag-gallery-canvas`      | `drag-place-replace` (DnD layer, drop targeting); `drag-swap-unplace` (8-task limit)                                                                          |
| `library-storage`          | `library-storage` (interface, memory adapter, contract suite); `library-storage-fsa` (FSA adapter, worker load); `session-state` (IndexedDB, Web Locks)       |
| `asset-identity`           | `asset-record-schema` (schema bump); `asset-identity` (AssetSource, hashing, matcher); `derived-cache-opfs` (OPFS cache)                                      |
| `open-save-project`        | `open-save-project`; `autosave` (8-task limit, own gate); `permissions-locks-ux`                                                                              |
| `recents-and-relink`       | `recents-home` (home screen); `missing-assets-relink` (view)                                                                                                  |
| `filmstrip-management`     | `filmstrip-sort-filter`; `filmstrip-resize-drop` (8-task limit); OPFS bullet dropped (in `derived-cache-opfs`)                                                |
| `spread-management`        | `spread-list-panel` (panel); `spread-reorder-retemplate` (8-task limit)                                                                                       |
| `layout-grid`              | `layout-grid` (book setup panel); `grid-overlay` (editor overlay layer)                                                                                       |
| `frame-geometry-ops`       | `frame-transform-ops`; `snapping-engine` (anchor index, bench)                                                                                                |
| `rulers-guides`            | `rulers` (canvas layer); `guides`                                                                                                                             |
| `free-frames`              | `frame-selection-handles` (handles in the overlay layer); `free-frames` (8-task limit)                                                                        |
| `text-blocks`              | `text-frame-model` (prep — schema bump); `text-blocks` (inline editing, bundled fonts)                                                                        |
| `image-derivatives`        | `image-derivatives` (presets, native encode, cache); `avif-encoder` (8-task limit: multithreaded WASM, fallback)                                              |
| `site-viewer`              | `site-viewer` (Vite entry; in-app preview is wiring); `site-lightbox` (lightbox region)                                                                       |
| `static-export`            | `static-export-core` (prep — prerender, deterministic tree); `static-export` (worker write)                                                                   |
| `print-overlays-preflight` | `print-overlays` (overlays on the existing layer); `preflight-panel` (warnings panel)                                                                         |
| `pdf-export`               | `pdf-painter` (prep — pdf-lib fork, worker); `pdf-export` (UI, memory gate); `pdf-captions`; `pdf-streaming` (contingency)                                    |
| `cover-spine`              | `cover-model` (prep — schema bump); `cover-spine`                                                                                                             |
| `in-app-publish`           | `publish-credentials` (credentials, CSP; Security Review); `in-app-publish` (upload worker)                                                                   |

`pdf-painter`, `library-storage-fsa` and `publish-credentials` each add one subsystem; their worker or dependency counts with it. `zoom-image-tiers`, `static-export` and `in-app-publish` are `[feature]`s whose one subsystem is non-UI and add no new UI region, so rule 1 needs no `[prep]`. `print-profiles` and `publish-revisions` are schema `[prep]`s with pure functions riding along (rule 2). M8 gets the line `**Re-plan:** at the M7 review cut; items are not yet sliced to the change budget.` `docs/future-architecture.md` LOD and PDF-memory fallbacks name `far-zoom-lod` and `pdf-streaming`.

## Touch-set

`docs/roadmap.md`, `openspec/config.yaml`, `.cursor/agents/openspec-proposal-reviewer.md` (check 5), `docs/future-architecture.md` (two fallback references), delta spec → main spec at archive.

Verification: `openspec validate roadmap-change-sizing`; `openspec instructions proposal|tasks` show the budget; `prettier --check` on touched files; `pnpm verify:fast`; per-original bullet diff (old nested bullets ⊆ new ones).

## Risks / Trade-offs

- [Scope lost in moves] → per-original bullet diff before ticking.
- [Contingency items linger] → closing rule 3.
- [Definition still needs judgment] → exclusions list; proposal reviewer enforces.
