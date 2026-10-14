# Tasks

## 1. Tests first

- [x] 1.1 Add shared `seedGallery(n)` helper using public `resetBookStore` (sync seed; no rAF)
- [x] 1.2 Add `src/editor/Filmstrip.test.tsx`: spacer width for large N; filmstrip containment (`min-width: 0`, overflow hidden) — must fail before CSS fix
- [x] 1.3 Add `src/editor/EditorShell.test.tsx` (or extend App tests): seeded gallery + shell overflow/width/`min-width: 0` containment — must fail before CSS fix
- [x] 1.4 Add Playwright case in `e2e/filmstrip.spec.ts`: bulk import → no page H/V scroll; filmstrip `scrollWidth > clientWidth`; `scrollLeft` works

## 2. CSS fix

- [x] 2.1 Lock `.editor-shell` to viewport (`height`/`max-height: 100svh`, `width`/`max-width: 100%`, `overflow: hidden`, `min-width: 0`)
- [x] 2.2 Set `min-width: 0` (and workspace `min-height: 0`) on grid children
- [x] 2.3 Contain `.filmstrip` / `.filmstrip-scroll` (`min-width: 0`, `max-width: 100%`, filmstrip `overflow: hidden`)
- [x] 2.4 Add `index.css` belt only if e2e still fails after 2.1–2.3 (not needed)

## 3. Docs / archive prep

- [x] 3.1 Append lesson: grid child + wide virtualized spacer needs `min-width: 0` / shell viewport lock
- [x] 3.2 Sync delta into `openspec/specs/editor-shell/` and archive change after review

## Verification

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify)
- [x] pnpm stryker:diff (score 68.18 ≥ break 60; CSS-only change, mutate set unchanged)
- [x] pnpm test:lhci when UI or bundle size is affected
- [x] Agent docs: if module map / commands / security surface / durable conventions changed → update AGENTS.md (≤150 lines); update .cursor/rules or skills only when a lasting convention changed; do not add alwaysApply rules without merging/removing another
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change (N/A — no lockfile/security surface)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] High-risk security surface: Cursor Security Review subagent before archive (N/A — CSS/layout only)
