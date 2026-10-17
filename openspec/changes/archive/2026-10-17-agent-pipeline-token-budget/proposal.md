# Proposal

## Problem

`/next-roadmap-item` wastes most input tokens on pre-push e2e detours, re-reading injected rules/config, untrimmed logs, and broad reviewer briefs — not on the item (issue #77; ~4.8M input in one session).

## Why now

M2.1 agent runs must finish before usage limits; the same traps already aborted a prior session. Product flake fix stays on `add-spread-reveal-flake`.

## Scope in

- Lefthook pre-push = `verify:fast` only; Playwright stays a required CI PR check (no weaker gates)
- Command + RULES + git-finish: out-of-scope failures → `roadmap add --after` or bug issue (not this PR); ≤2 local push attempts then report; re-run implementation review after post-review code deltas; no re-read of injected files / item after `roadmap next`; rules from `openspec instructions`; `config.yaml` operations ≤1; targeted spec/item edits; quiet verify/e2e + trimmed push/CI; PR body once; issues as plain URLs
- Reviewer agents: brief = slug, change path, relevant rules, touch-set working-tree diff; no other-session transcripts
- Non-interactive Node/pnpm bootstrap without committing `.tool-versions`; AGENTS + README state pre-push vs CI e2e
- `agent-context` requirements for the above

## Scope out

- Flaky e2e product fixes; splitting `openspec/config.yaml`; auto-prune remote branches; app `src/`; changing CI e2e thresholds

## Success criteria

- `lefthook.yml` pre-push invokes `pnpm verify:fast` (not full `verify`)
- CI still runs Playwright on every PR; no coverage/mutation exclusions or softer gates in this change
- Quiet verify/e2e scripts exist; agent bootstrap puts `pnpm` on PATH without a repo `.tool-versions`
- Command, RULES, git-finish, three reviewer agents, AGENTS, README match the scope-in behaviors
- `agent-context` delta covers them; `pnpm verify:fast` green

## Risks

- Soft text rules can be ignored — pre-push change is the mechanical stop; narrow briefs cut sub-agent waste
- Local green + CI e2e red on unrelated flakes — accepted; out-of-scope rule forbids in-PR flake fixes

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `agent-context`: token hygiene for unattended flow, pre-push vs CI e2e, push/out-of-scope budget, narrow briefs, agent env

## Impact

Agent docs/hooks/scripts and `agent-context` only; docs-only LOC well under Change size budget (one prep, ≤8 tasks); no product runtime.
