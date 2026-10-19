# Proposal

## Why

**Problem:** Agent rules are restated across `AGENTS.md`, `.cursor/rules`, commands, agents, and OpenSpec config, so alwaysApply context stays large and conflicting prose drifts. File size is soft guidance only (Doc budget), not a ratcheted gate.

**Why now:** Owner priority right after `lessons-dissolve`; M2.1 review cut needs one owner per rule and a shrink-only size budget so reviews stop bouncing on duplicated instructions.

## What Changes

- Assign one owner per rule; delete verified duplicates; leave a one-line pointer at non-owners only when a cross-link is required.
- Add per-rule-file line/char budgets in `quality/gates.json`; enforce on head in `pr-policy` / `check-gate-ratchet`; ratchet budgets lower-stricter (may only go down).
- Keep “repeated finding → automated check” owned by `openspec/config.yaml` quality bar; do not restate it as new prose elsewhere.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `ci-gates`: rule-file line/char budgets in `quality/gates.json`; absolute over-budget fails `pr-policy`; budget numbers join the numeric ratchet (lower-stricter).
- `agent-context`: one-owner rule map; navigation/rules/commands/agents must not duplicate owned mandates; Doc budget replaced/backed by the gate.

## Impact

**Scope in:** `AGENTS.md`, `.cursor/rules/*.mdc`, thin dedup in commands/agents/reviewer briefs when they restate owned rules; `quality/gates.json`; `check-gate-ratchet` (+ tests/fixtures); `ci-gates` + `agent-context` deltas; roadmap item ticks.

**Scope out:** Product UI; inventing `quality/review-checklist.md` (later `agent-self-check`); rewriting OpenSpec upstream opsx-* command bodies beyond duplicate project rules; dependency changes; raising budgets above post-dedup sizes.

**Success criteria:** PR body lists every removed duplicate with kept owner; scratch over-budget rule file fails the budget check and current tree passes; total bytes of scoped rule files lower than pre-change `main`; `pnpm check` OK.

**Risks:** Over-aggressive cuts drop an alwaysApply invariant agents still need (mitigate: keep owners explicit; pointer lines only). Budget globs miss a rule surface (mitigate: list paths in gates + unit tests on real tree).
