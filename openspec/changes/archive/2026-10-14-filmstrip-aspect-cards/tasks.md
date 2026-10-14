# Tasks

## 1. Aspect sizing helper + store seam

- [x] 1.1 Add pure `thumbSlotSize(aspect)` in `src/editor/thumbSlotSize.ts` (fixed height 96, clamp width ~48–288) with unit + PBT; verify portrait width < landscape width and clamps hold
- [x] 1.2 Extend `bookStore` with stable per-id aspect getter + subscribe that notifies on meta updates; verify in `bookStore.test.ts` (stable snapshot when unchanged; notify on `setAssetSessionMeta`)

## 2. Parametrized filmstrip items

- [x] 2.1 Update `FilmstripItem` to size from aspect via `thumbSlotSize`, use `object-fit: contain`, expose test hooks (`data-aspect` / orientation); verify unit/render that slot dimensions follow aspect
- [x] 2.2 Update `Filmstrip` virtualization to prefix-sum item widths (spacer, `translateX`, scroll→index, `ListLayout`); verify `Filmstrip.test.tsx` spacer/window math for mixed aspects

## 3. Status strip

- [x] 3.1 Add `FilmstripStatus` (count + import progress with `aria-live`, keep `import-progress` testid); wire props from `EditorShell` → `Filmstrip`; remove header progress duplicate
- [x] 3.2 E2E in `e2e/filmstrip.spec.ts`: portrait vs landscape distinct widths; status shows count; progress visible mid-import; keep progressive + LoAF + `assertDocumentFitsViewport` / `assertNamedScrollport`

## 4. Finish

- [x] 4.1 Sync delta `editor-shell` and `photo-card` into main specs on archive
- [x] 4.2 Append `docs/lessons.md` only if a review finding repeats (N/A)

## Verification

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify)
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected
- [x] Agent docs: if module map / commands / security surface / durable conventions changed → update AGENTS.md (≤150 lines); update .cursor/rules or skills only when a lasting convention changed; do not add alwaysApply rules without merging/removing another (N/A)
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change (N/A)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced) — pass, agent d494238a-c8b4-448c-b2be-aaa866c567ab
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive — pass, agent d0935cef-8da8-48ac-bb3f-9f9228463f5c
- [x] High-risk security surface: Cursor Security Review subagent before archive (N/A — blob/worker surface unchanged)
