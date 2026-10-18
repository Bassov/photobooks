# Tasks

## 1. Slug selection and claim

- [x] 1.1 Add `roadmap next --slug` validation (exists, open, active milestone; contingency only when requested) plus `claim`/`claimed-set` helper; keep `--skip`; unit tests for unknown/done/contingency/happy paths — verify `node --test scripts/roadmap.test.mjs` covers those cases

## 2. Worktree preflight and claimed set

- [x] 2.1 Extend claimed set with local + worktree `feat|fix/*`; implement `agent preflight --slug` (branch from `origin/main`, no local `main` switch/pull); keep no-slug main-checkout flow — verify with tmp repo + linked worktree where `main` is checked out elsewhere

## 3. Worktree-safe git paths

- [x] 3.1 Resolve push-failure (and any other git-internal) paths via `git rev-parse --git-path`/`--git-dir` — verify linked-worktree unit test reads/writes the counter

## 4. Done state, sync, archive

- [x] 4.1 Item-file `Status: done`; `done` does not tick index or archive; add `sync` + `archive <M>`; check warns (not fails) on fully-done-but-active; migrate nine M2.1 `[x]` files — verify parallel-done merge fixture (no `docs/roadmap.md` conflict) and check/archive tests

## 5. Lessons per-entry

- [x] 5.1 Split `docs/lessons.md` into `docs/lessons/NN-*.md` + index; update `openspec/config.yaml`, AGENTS.md, and any append mandates — verify two new entry files can coexist and `rg` finds updated paths

## 6. Finish merge and command slug

- [x] 6.1 `cmdFinish` auto-merges trivial `main` conflicts (allowlist); update `git-finish.mdc` and `/next-roadmap-item [<slug>]` — verify merge unit test for roadmap/doc conflict and command doc mentions `--slug`

## 7. Per-worktree e2e port

- [x] 7.1 Honor `E2E_PORT` (default 4173) in Playwright config/preview; `reuseExistingServer: false` — verify config resolves custom port (unit or smoke assert)

## 8. Docs/skills alignment

- [x] 8.1 Update roadmap skill + RULES for done/sync/archive; tick item checkboxes — verify skill text no longer says done archives the milestone

## Verification

- [x] pnpm typecheck (via `pnpm verify:fast:quiet`)
- [x] pnpm lint (via `pnpm verify:fast:quiet`)
- [x] pnpm test — `scripts/roadmap.test.mjs` + `scripts/agent.test.mjs` green (171+ tests); full suite in verify:fast:quiet
- [x] pnpm test:e2e (or pnpm verify) — N/A locally per owner (no full e2e; Playwright stays in CI); scripts-only change
- [x] pnpm stryker:diff — score ≥85 on second run after added merge/worktree tests; survivors listed below if any remain equivalent/logging
- [x] pnpm test:lhci when UI or bundle size is affected — N/A (no UI/bundle)
- [x] UI in scope: browser smoke evidenced — N/A (no UI)
- [x] Docs/rules sync: AGENTS.md, git-finish.mdc, next-roadmap-item.md, roadmap skill, RULES.md, openspec/config.yaml, future-architecture lessons pointer, implementation-reviewer lessons pointer
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A (no dep/security surface)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced) — pass (resume c14e0e7d)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive — high findings addressed (worktree/claimed/merge/E2E_PORT/pre-push merge); re-check after delta
- [x] Manual check — see ## Manual test scenarios (prep/CLI; N/A browser)
- [x] Security Review — N/A (not tagged; no security surface)

## Manual test scenarios

1. `pnpm roadmap next --slug roadmap-parallel-agents` → prints this item; `--slug nope` → clear error.
2. In a tmp linked worktree with `main` held elsewhere, unit test `linked worktree preflight --slug` creates `feat/wt-slug` and leaves primary on `main` — observed: pass.
3. `collectSkipSlugs` with local + worktree porcelain → skips those slugs — observed: pass.
4. Two `roadmap done` calls leave `docs/roadmap.md` unchanged until `sync`; `archive` after full done — observed: unit tests pass.
5. `playwright.config.ts` source wires `E2E_PORT` and `reuseExistingServer: false` — observed: unit assert pass.

### Stryker survivors (non-behavioral / equivalent)

- `roadmap.mjs` migrate `.filter(Boolean)` on slug map — equivalent when slugs always truthy
- `roadmap.mjs` / `agent.mjs` `main()` stdout/stderr write conditionals — process I/O glue
- Deferred NoCoverage (finish catch / switchFeatureBranch fallback / archive CLI edges): follow-up `roadmap-parallel-agents-mutation-coverage` (score was 88.16 with NoCoverage > 0 on last local run)
