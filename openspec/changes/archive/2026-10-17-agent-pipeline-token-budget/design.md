# Design

## Context

See proposal.md. Pre-push currently runs full `pnpm verify` ([lefthook.yml](lefthook.yml)); `/next-roadmap-item`, RULES, git-finish, and reviewers lack token-hygiene / out-of-scope / brief contracts. Docs/hooks/scripts only.

## Goals / Non-Goals

**Goals:**

- Mechanical: pre-push = `verify:fast`; quiet scripts; agent-env bootstrap
- Soft: command/RULES/git-finish/reviewers encode hygiene, out-of-scope, push budget, narrow briefs
- Spec: `agent-context` delta for the above

**Non-Goals:**

- Flaky e2e product fixes (`add-spread-reveal-flake`)
- Splitting `openspec/config.yaml`
- Auto-delete remote branches on merge
- Changing CI e2e thresholds or exclusions

## Decisions

1. **Pre-push only `verify:fast`** — Prefer always-fast over conditional e2e-by-glob (simpler, matches issue primary fix). Playwright stays in CI (`pnpm verify` / integration workflow unchanged). Update README + git-finish wording.

2. **Quiet scripts** — Add `verify:fast:quiet` and `test:e2e:quiet` wrapping vitest/playwright with dot/`--silent` (or equivalent). Command/git-finish tell agents to prefer them and `| tail -n …` for push; CI: `gh pr checks --watch >/dev/null` then `--json name,bucket`; failed logs `| tail -n 80`.

3. **agent-env.sh** — Export asdf shims + `ASDF_NODEJS_VERSION` from `.nvmrc` (or first installed 22.x) without writing `.tool-versions` into the repo (Cloudflare lesson). Command preflight sources it once. Document one AGENTS line under Cursor Cloud / toolchain.

4. **No config.yaml split** — Rules stay in instructions JSON; agents may open `operations` once. Avoids churn for a 115-line file.

5. **Reviewer Inputs rewrite** — Parent passes brief; agents say “honor rules from brief” instead of “Honor openspec/config.yaml”. Implementation reviewer prefers conversation evidence over re-running full e2e.

6. **Out-of-scope + 2 pushes** — RULES + command + git-finish. CI red-round limit stays 3; local push attempts capped at 2.

## Touch-set

| File                                                 | Why                                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------------------- |
| `lefthook.yml`                                       | pre-push → `pnpm verify:fast`                                              |
| `package.json`                                       | `verify:fast:quiet`, `test:e2e:quiet`                                      |
| `scripts/agent-env.sh`                               | Node/pnpm for non-interactive shells                                       |
| `.cursor/commands/next-roadmap-item.md`              | preflight source, hygiene, quiet, out-of-scope, 2-push, re-review, PR once |
| `docs/roadmap/RULES.md`                              | out-of-scope, push budget, targeted item edits                             |
| `.cursor/rules/git-finish.mdc`                       | verify:fast pre-push, quiet CI wait, 2 local push retries                  |
| `.cursor/rules/testing.mdc`                          | local verify:fast / quiet; e2e when in scope + CI                          |
| `.cursor/agents/openspec-proposal-reviewer.md`       | brief-based Inputs                                                         |
| `.cursor/agents/openspec-design-reviewer.md`         | brief-based Inputs                                                         |
| `.cursor/agents/openspec-implementation-reviewer.md` | brief-based Inputs; prefer evidence over full e2e re-run                   |
| `AGENTS.md`                                          | agent-env + quiet scripts (≤150 lines)                                     |
| `README.md`                                          | Lefthook pre-push line                                                     |
| `openspec/changes/…/specs/agent-context/spec.md`     | delta                                                                      |
| `openspec/specs/agent-context/spec.md`               | sync at archive                                                            |
| `docs/roadmap/M2.1/agent-pipeline-token-budget.md`   | tick scope (targeted)                                                      |
| `docs/roadmap.md`                                    | via `pnpm roadmap done` only                                               |

No gate-threshold / exclusion / CI workflow edits. No `src/`. No e2e assertion changes.

## Composition / boundaries

- Mandates remain in config + specs; AGENTS stays navigation.
- Quiet scripts are thin wrappers; no new subsystem.

## Risks / Trade-offs

- [Soft rules ignored] → Mitigate: mechanical pre-push + brief Inputs text.
- [CI e2e red on unrelated flake] → Mitigate: out-of-scope rule; flake item already queued.

## Migration

One PR; archive syncs `agent-context`. No runtime migration.
