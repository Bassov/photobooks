# Tasks

## 1. Quiet changed e2e

- [x] 1.1 Add `scripts/e2e-changed-quiet.mjs` (and CLI entry if needed) that reuses burn-in target resolution, runs Playwright with a quiet reporter on those specs only, prints failures + a one-line summary, and exits 0 with “no targets” when empty; wire `pnpm test:e2e:changed:quiet` in `package.json`; verify with unit tests on the public `main`/helpers (mock git/spawn only), extending `e2e-burn-in-targets` test patterns

## 2. Agent finish: no CI watch + run metrics

- [x] 2.1 Remove `gh pr checks --watch` and CI-watch summary stage from `cmdFinish`; success is push + PR URL; update `scripts/agent.test.mjs` so finish tests assert no watch and still cover create/update/push-budget paths
- [x] 2.2 Record run start in `cmdPreflight` (`.git/agent-run-started.json`); on PR create inject auto `## Metrics` (`wall_time_sec`, optional `tokens` from `AGENT_TOKEN_USAGE`); add `## Metrics` to `.github/PULL_REQUEST_TEMPLATE.md`; verify with agent unit tests

## 3. Parallel burn-in no-op

- [x] 3.1 Split `.github/workflows/integration.yml`: job `e2e-burn-in` parallel to `integration`; no-target path is checkout + `node` target resolve only (no pnpm install / browsers / build); with targets, install and burn-in; strip burn-in from `integration`; `ci-comment` needs both and wires burn-in artifacts into existing summary flags; verify with workflow/policy unit tests where the repo already asserts integration burn-in shape

## 4. Docs and roadmap scope

- [x] 4.1 Document once-green local policy + quiet changed-e2e command + no CI-watch finish in `AGENTS.md` (≤150 lines), `.cursor/commands/next-roadmap-item.md`, `.cursor/rules/git-finish.mdc`, and `.cursor/rules/testing.mdc`; tick matching scope checkboxes in `docs/roadmap/M2.1/agent-test-run-budget.md`

## Verification

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify) — `pnpm test:e2e:changed:quiet` → `changed-e2e: no targets` (no e2e files in this PR); full suite deferred to CI
- [x] pnpm stryker:diff — score 83.91 (≥60). Skipped survivors: `return code === 0 ? 0 : code` equivalent to returning `code`; default `write`/`error`/CLI entry no-cov (stdio side effects); remaining agent.mjs survivors largely pre-existing finish/preflight chrome
- [x] pnpm test:lhci when UI or bundle size is affected — N/A (no UI/bundle)
- [x] UI in scope: browser smoke evidenced — N/A (no UI)
- [x] Docs/rules sync: AGENTS.md, next-roadmap-item, git-finish, testing.mdc, PR template, roadmap item ticks
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A (script entry only; no dep/lock change)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive — pass
- [x] Manual check (after implementation review pass, before archive): N/A for non-UI prep; see Manual test scenarios
- [x] Security Review: Cursor Security Review subagent before archive when the item is tagged (Security Review: …) or the change touches the security surface — N/A (not security-tagged; no security surface)

## Done-when evidence notes

- Burn-in no-op &lt;1 min: this PR touches no e2e specs/support — measure `e2e-burn-in` job wall time in this PR’s CI (expected checkout + node resolve only).
- No local e2e repeat loop: this agent run used one `test:e2e:changed:quiet` (`no targets`) and targeted unit tests once; feeds `agent-pipeline-run-audit`.

## Manual test scenarios

1. N/A — prep/tooling only (no product UI). Evidence: `pnpm test:e2e:changed:quiet` printed `changed-e2e: no targets` in 0.6s; unit suites green.
