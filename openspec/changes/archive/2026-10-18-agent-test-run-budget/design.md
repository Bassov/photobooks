# Design

## Context

See proposal.md — Why. Today burn-in is a step inside the `integration` job (browsers always install), `pnpm agent finish` watches CI, and agents lack a quiet changed-e2e entry that reuses `scripts/e2e-burn-in-targets.mjs`.

## Goals / Non-Goals

**Goals:** once-green local policy in docs/command; quiet changed-e2e; finish stops at PR URL; parallel burn-in job with fast no-target path; auto wall-time (+ optional tokens) in PR metrics.

**Non-Goals:** changing burn-in count / main-suite retries; full run-audit dashboard; product UI.

## Decisions

1. **Quiet changed e2e** — Add `scripts/e2e-changed-quiet.mjs` (+ `pnpm test:e2e:changed:quiet`) that calls `selectBurnInTargets` / `collectChangedPaths` from `e2e-burn-in-targets.mjs`, then `with-playwright-env` + Playwright `--reporter=dot` on those paths. Empty targets → exit 0 + one-line “no targets”. Public API under test: `main` / target selection helpers (extend existing `e2e-burn-in-targets.test.mjs` patterns; mock spawn/git only).

2. **Finish drops CI watch** — Remove `gh pr checks --watch` and post-watch summary from `cmdFinish`; success = push + PR URL. Update `.cursor/rules/git-finish.mdc` and `/next-roadmap-item` accordingly. Keep merge-on-reject and two-push budget.

3. **Run clock + PR metrics** — `cmdPreflight` writes `.git/agent-run-started.json` (`{ startedAtMs }`). On `gh pr create`, finish injects a `## Metrics` block into the body (temp file) with `wall_time_sec` from that stamp; include `tokens` from `AGENT_TOKEN_USAGE` when set. Existing PR updates do not rewrite metrics (create-path is enough for audit seed).

4. **Parallel burn-in job** — In `.github/workflows/integration.yml` (gate workflow: needed so no-target PRs skip browser install and burn-in is not serialized before main e2e): add job `e2e-burn-in` with no `needs` on `integration`. No-target path: `actions/checkout` + `node scripts/e2e-burn-in-targets-cli.mjs` only (zero-dep; no `pnpm install`, no browser install, no build) → print “no targets” and exit 0. When targets exist: then `pnpm install`, Playwright browsers, burn-in run. Strip burn-in steps from `integration`. `ci-comment` `needs: [integration, e2e-burn-in]`; download burn-in JSON artifact when present and pass existing `--burn-in*` flags into `e2e-playwright-summary` (workflow wiring only).

5. **Docs** — Short policy bullets in `AGENTS.md` (stay ≤150 lines) and the command; no new alwaysApply rule.

## Risks / Trade-offs

- [CI comment race] → `ci-comment` waits on both jobs; section pack tolerates missing burn-in report when no targets.
- [Agents miss local bugs] → accepted; CI e2e + burn-in remain required.
- [Metrics only on create] → follow-up audit item can extend updates if needed.

## Touch-set

| Path                                         | Why                                                               |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `scripts/e2e-changed-quiet.mjs`              | quiet changed-e2e logic                                           |
| `scripts/e2e-changed-quiet-cli.mjs`          | CLI entry                                                         |
| `scripts/e2e-changed-quiet.test.mjs`         | unit tests                                                        |
| `scripts/agent.mjs`                          | finish no-watch; preflight clock; metrics inject                  |
| `scripts/agent.test.mjs`                     | finish/metrics/preflight tests                                    |
| `scripts/e2e-playwright-summary.test.mjs`    | workflow shape asserts only                                       |
| `package.json`                               | `test:e2e:changed:quiet` script                                   |
| `vite.config.ts`                             | **coverage scope**: include quiet-e2e module (wider)              |
| `stryker.config.json`                        | **mutation scope**: include quiet-e2e module (wider)              |
| `.github/workflows/integration.yml`          | **gate workflow**: parallel burn-in job + no-target short-circuit |
| `AGENTS.md`                                  | local test policy                                                 |
| `.cursor/commands/next-roadmap-item.md`      | once-green + no CI watch                                          |
| `.cursor/rules/git-finish.mdc`               | stop after PR URL                                                 |
| `.cursor/rules/testing.mdc`                  | targeted quiet e2e policy                                         |
| `.github/PULL_REQUEST_TEMPLATE.md`           | `## Metrics` placeholder                                          |
| `docs/roadmap/M2.1/agent-test-run-budget.md` | tick scope                                                        |

No code changes to `e2e-playwright-summary.mjs` / `ci-report-comment.mjs` (workflow artifact wiring only).

## Migration

Ship on this PR; no-op burn-in timing from this PR’s CI is the Done-when evidence. Rollback: revert workflow job split and restore finish watch.
