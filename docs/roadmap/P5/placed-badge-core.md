# placed-badge-core

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item placed-badge-core
Status: done

Core part of the Designer "placed badge" (tool 4; Owner Q-25 2026-11-20: click + count, cycle through places; three items: core, kit, prod). Designer spec `placed-badge/spec.md` "Places (order = spread-list order)" and Must PB2. The later prod item jumps from a filmstrip badge to every place a photo sits in; core supplies the ordered list.

## Scope

- [x] `src/core/selectors/placements.ts`: `placementsOfAsset(book, assetId) → Place[]`, `Place = { kind: 'cover', panel } | { kind: 'endpaper', side } | { kind: 'frame', spreadId, frameId }`. Order: cover front / spine / back, endpaper front, every spread in book order with its frames in paint order (z ascending, own frames and override copies alike), endpaper back. One shared traversal with `placementCountByAsset` (same rules, no fork).
- [x] `src/core/index.ts`: `placementsOfAsset` + `type Place` in the existing placements export block only.
- [x] `src/core/selectors/placements.test.ts`: unit order cases (cover panels, endpaper front, spreads, frames bottom → top, override copies, endpaper back, unplaced → `[]`) + PBT: `placementsOfAsset(b, a).length === (placementCountByAsset(b).get(a) ?? 0)` for every asset.
- **Browser check:** none (core selector only; no UI until the prod item).

## Done when

- `placementsOfAsset` + `Place` exported from `src/core/index.ts`; existing placements tests unchanged and green.
- Unit order cases + PBT green; stryker-diff on `placements.ts` not below the repo threshold.
- `pnpm roadmap check` green; item Status: done.
