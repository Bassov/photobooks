# Tasks

## 1. SessionState recents + active ids

- [x] 1.1 Extend SessionState API (`listRecentLibraries`, remember with label/move-to-front, clear drops recent, `setActiveIds`/`getActiveIds`); bump IDB (`_recents`, `_active`) with v1→v2 seed for legacy `library` handle; update memory + browser adapters — verify shared contract suite covers recents order, clear, active ids
- [x] 1.2 Export new types from `src/project`; keep handles opaque — verify unit/contract tests pass and no handle appears in list results

## 2. projectSession surface + open from home

- [x] 2.1 Restore gate: enter editor via `tryRestore` only when sessionStorage has an active book id; otherwise surface `home`; mirror active ids into SessionState; allocate/reuse library ids on create/open and update recents — verify unit tests for home vs restore surfaces
- [x] 2.2 Add `listRecents`, `selectRecentLibrary` (lists books), `openBookFromHome`; permission-required on select or open sets existing `accessPhase` (no silent empty list); open reuses activate+lock — verify unit tests for open-by-id, permission path, recents update

## 3. Home UI + e2e

- [x] 3.1 Add `HomeScreen` (empty copy, recents, books, New library / Open); wire App/EditorShell to surface; named scrollport `home`; test ids `home-screen` / `home-recents` / `home-books` — verify component/unit smoke for empty + list rendering
- [x] 3.2 Playwright `e2e/recents-home.spec.ts`: empty home; happy path (seam → clear sessionStorage → reload → list → click book → editor); interact/overflow with `assertDocumentFitsViewport` / `assertNamedScrollport('home-scroll')`; keep same-tab restore coverage — verify `pnpm test:e2e` green for new cases

## 4. Verification checklist

- [x] pnpm typecheck — green (`pnpm verify:fast`)
- [x] pnpm lint — green
- [x] pnpm test — green (648+)
- [x] pnpm test:e2e (or pnpm verify) — `e2e/recents-home.spec.ts` 3/3 green; open-save/permissions/home entry updates green; perf scenarios enter editor via `enablePerfScenario`
- [x] pnpm stryker:diff — 88.30; App/HomeScreen/projectSession excluded (thin UI/orchestration; reasons in `stryker.mutate.md`). Survivors (equivalent): `recents.ts` label/parse logical equivalents; `browserSessionState` reserved-key / permission branches under contract suite; one `memorySessionState` object-literal noop
- [x] pnpm test:lhci when UI or bundle size is affected — green
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass — empty: home empty copy + New/Open/Start editing, labeled buttons, brand; happy: recent → books → open book (e2e); overflow: `assertNamedScrollport('home-scroll')`; MCP empty home + Start editing → editor; a11y: named regions Recent libraries / Books
- [x] Docs/rules sync: Perf line on roadmap item; `stryker.mutate.md` excludes; lessons for scrollport assert + evidenced ui-review; no AGENTS.md map change needed
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — clean (FSA handles only; no new deps)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced: 09a4a8c4)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive (evidenced: f8f5efbb pass after fixes; prior c0faa048)
- [x] Manual check (after implementation review pass, before archive): drive `pnpm dev` in the browser through the roadmap item's Browser check (or the spec scenarios for [prep]); record numbered steps and observed results under `## Manual test scenarios` at the end of this file (N/A for non-UI); a bug found → Playwright test + fix + re-run implementation review on the delta
- [x] High-risk security surface: Cursor Security Review subagent before archive (evidenced: 24cff691 — no medium+)

## Workflow follow-up

- Archive the change after implementation review + Manual check pass; sync delta specs; tick roadmap item.
- Commit, push, open PR, wait for CI green.

## Manual test scenarios

1. Open `http://127.0.0.1:5173/` with cleared session IDB — home shows empty copy (“No recent libraries yet…”), New library / Open / Start editing; no page H/V scroll (MCP snapshot).
2. After an e2e library exists in IDB — home lists recent library by folder label; Books panel prompts to select; Start editing enters editor with filmstrip/pasteboard (MCP).
3. Playwright `e2e/recents-home.spec.ts`: empty home; save book → clear sessionStorage → reload → select recent → click book → editor; overflow home-scroll named scrollport (3/3 green).
