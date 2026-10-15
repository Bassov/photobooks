# Tasks

## 1. Failing end-to-end lock

- [x] 1.1 Add a Playwright test in `e2e/spread-view.spec.ts` that fits the spread, records the zoom percent and the previous last spread's on-screen height, then adds a spread. Assert the percent is unchanged, that height is unchanged while the spread becomes two pages wide, and the new one-page `spread-view` box is contained by `pasteboard-scroll` (about 1 px). The slot padding is the gap and is not that proof. Reuse `assertDocumentFitsViewport` and `assertNamedScrollport` on `pasteboard-scroll`. Do not treat `readSpreadSlots` `inScrollport` overlap as containment. Verify: the test fails on current code.

## 2. Reveal after layout

- [x] 2.1 In `Pasteboard`, keep the committed zoom and scroll the new spread into view only after its slot has layout. Move the tracked scroll with the existing stride so the last index mounts, then set `scrollTop` from that slot's position. Do not assign `scrollHeight` before that box exists, and do not call `commitZoom` or `placeZoom` from Add spread. If the test in 1.1 shows the indicator back at 13%, remove that reset in `Pasteboard` or `usePasteboardCamera` and leave page-role widths alone. Verify: 1.1 passes and a component test in `SpreadTemplateBar.test.tsx` no longer expects `scrollTop` to equal a stubbed `scrollHeight` of 900 before the new slot exists; committed zoom stays unchanged.

## 3. Verification

- [x] 3.1 Run `pnpm verify` and `pnpm stryker:diff` on the production files this change touches. Do not shrink the default `src/**/*.ts` / `src/**/*.tsx` mutate scope. Verify: both commands exit 0 and their output was read. `pnpm verify` exit 0 (typecheck, lint, unit, e2e; one keyboard-place flake passed on retry). `pnpm stryker:diff` exit 0 on `src/editor/Pasteboard.tsx`: 185 killed / 308 mutants, 60.06% (break 60).

## Verification checklist

- [x] pnpm typecheck (inside `pnpm verify`, exit 0)
- [x] pnpm lint (inside `pnpm verify`, exit 0)
- [x] pnpm test (inside `pnpm verify`, exit 0)
- [x] pnpm test:e2e (or pnpm verify) (`pnpm verify` exit 0; add-spread camera e2e passed; camera-controls fit e2e passed in isolation after a load-timeout when verify ran beside Lighthouse)
- [x] pnpm stryker:diff (exit 0, 60.06% on full `Pasteboard.tsx`)
- [x] pnpm test:lhci when UI or bundle size is affected (exit 0)
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass (empty gallery sentence, Fit+Add keeps fitted percent and contains the new spread-view, mid-scroll still covers the port; `ui-review` pass)
- [x] Agent docs: if module map / commands / security surface / durable conventions changed → update AGENTS.md (≤150 lines); update .cursor/rules or skills only when a lasting convention changed; do not add alwaysApply rules without merging/removing another (N/A — no module map, command, or convention change)
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change (N/A — no package or lockfile change)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced: pass after spread-view containment vs slot-padding clarification)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive (pass; no critical/high. Low: security N/A; optional e2e guard that fitted percent is not 13% left as a non-blocking note)
- [x] High-risk security surface: Cursor Security Review subagent before archive (N/A — pasteboard reveal and overflow-anchor only; no File System Access, workers, blob URLs, CSP, dependencies, or export)

## Workflow follow-up

- Archive only after `openspec-implementation-reviewer` passes, syncing the editor-shell delta first.
- Tick the existing `docs/roadmap.md` `add-spread-camera` checkbox in that archive. Do not add a second copy.
- Commit, push `feat/add-spread-camera`, and open the pull request.
