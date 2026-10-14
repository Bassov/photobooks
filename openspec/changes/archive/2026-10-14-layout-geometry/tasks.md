# Tasks

## 1. Geometry helpers and resolve

- [x] 1.1 Add spread size / page-cut helpers and crop→source-rect math under `src/core/geometry/`; unit tests for one-page vs two-page cuts and cover-crop with zoom/center
- [x] 1.2 Add `resolveSpread` with structural memo + always-fresh source crops; unit tests for interior cut, empty frame, aspect-lookup crop change
- [x] 1.3 Extend fixtures with `largeBook(40, 1000)`; add resolve bench with asserted budget

## 2. Templates

- [x] 2.1 Implement catalog generators (full-bleed, one-per-page, 2-up, 4-grid) per design rect formulas; unit tests for each layout on one- and two-page spreads
- [x] 2.2 Implement `applyTemplate` with index rebind and frame-id preservation; unit tests for photo keep-by-index and id policy

## 3. Ops and selectors

- [x] 3.1 Implement gallery add/remove (cascade), place/replace/unplace/swap; unit + PBT for referential invariants and place-on-filled no-op
- [x] 3.2 Implement apply template op, add/remove/move spread (add applies one-per-page; refuse last-spread remove); structural-sharing tests
- [x] 3.3 Add `applyBookOp` union dispatcher; selectors `placementCountByAsset` / `unplacedAssetIds` with unit tests
- [x] 3.4 Export public API from `src/core/index.ts`; ops/selectors benches on largeBook with budgets

## 4. Docs

- [x] 4.1 Tick nested `layout-geometry` checkboxes in `docs/roadmap.md` as work lands; note `layout-geometry` in `AGENTS.md` module map if needed

## 5. Verification checklist

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify)
- [x] pnpm stryker:diff — 74.87% (threshold 60)
- [x] pnpm test:lhci when UI or bundle size is affected — N/A (no UI)
- [x] Agent docs: AGENTS.md module map updated for layout-geometry
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A
- [x] Launch openspec-design-reviewer was pass before apply (evidenced: 631b2027)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive (evidenced: 60e434e6 pass)
- [x] High-risk security surface: Cursor Security Review — N/A (pure core math)

## Workflow follow-up

- Archive the change after implementation review pass; sync delta specs into main `openspec/specs/`.
- Commit, push, open PR; tick top-level `layout-geometry` only after merge.
