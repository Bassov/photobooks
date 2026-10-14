# Tasks

## 1. Window

- [x] 1.1 Add pure `pasteboardWindow` (uniform stride = trim height × `SPREAD_PX_PER_MM` + 24, half-open range, leading/trailing spacers, at least one row when the book is non-empty) and verify unit tests plus a fast-check property that leading + (end − start) × stride + trailing = count × stride and the range covers the viewport plus one stride of overscan. Add the module to `scripts/stryker-diff.mjs` and `stryker.config.json`

## 2. Pasteboard

- [x] 2.1 Replace `PainterFixtureWorkspace` and the placeholder with `Pasteboard`: `display: block` workspace, scrollport (`pasteboard-scroll`, region “Spreads”, focus ring, `overflow: auto`), slots (`fit-content`, `margin-inline: auto`, border-box stride, 24px padding gap, containment), rAF `scrollTop` window, `IntersectionObserver` `data-active`. Verify `EditorShell` tests: one session spread, no placeholder sentence, labeled region; fixture query does not mount 40 nodes

## 3. Browser

- [x] 3.1 Update `e2e/spread-view.spec.ts`: empty visit (one spread, empty frame, no placeholder sentence, `assertDocumentFitsViewport`); fixture (extent for 40, mounted count < 40, vertical `assertNamedScrollport`, mid-scroll cover, slot `data-active` moves, containment styles on the slot)

## 4. Perf gate

- [x] 4.1 Extend `enablePerfScenario` with an optional URL and add a `frame-budget gates` test that opens `/?fixture=painter&perf=1`, throttles, clears, scrolls top to bottom, then `assertNoLoafEntries` and `collectFrameStatsArtifact`. Point `pnpm perf` at that file and the filmstrip spec

## 5. Verification checklist

- [x] pnpm typecheck (verify:fast)
- [x] pnpm lint (verify:fast)
- [x] pnpm test (verify:fast, 263 tests)
- [x] pnpm test:e2e (or pnpm verify) — `e2e/spread-view.spec.ts` 3 passed after the containment assertion; earlier full e2e was 15 passed / 1 failed only on `contain` computed as `content`
- [x] pnpm stryker:diff — `pasteboardWindow.ts` score 68 ≥ 60
- [x] pnpm test:lhci when UI or bundle size is affected — performance budget passed
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass — empty frame centered with a real box; fixture shows the empty first frame and filled spreads; mid-scroll fills the pasteboard (4 mounted, 2 visible, scrollHeight 6960, document does not scroll)
- [x] Agent docs: no module-map, command, or security-surface change (`pnpm perf` remains the frame-budget command)
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — no high production advisories (script-only package.json edit)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced: pass, agent 931b6ef0)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive (pass, agent ef872695; medium scroll-extent and active-slot overlap assertions added after)
- [x] High-risk security surface: Cursor Security Review subagent before archive (not applicable: no File System Access, worker, header, dependency, or export change)

## Workflow follow-up

- Archive after implementation review passes; sync delta specs into `openspec/specs/`.
- Tick `pasteboard-workspace` and its nested boxes in `docs/roadmap.md` in this PR, without waiting for merge.
