# Design

## Context

Doc budget in `AGENTS.md` is soft; the same mandates are restated across alwaysApply rules, commands, and agents. `openspec/config.yaml` already owns “repeated finding → check.” Gate ratchet already compares numeric `quality/gates.json` fields and runs absolute head checks.

## Goals / Non-Goals

**Goals:** One owner per rule; delete duplicates (pointer-only at non-owners); `agentRules.budgets` in gates; absolute over-budget fails `pr-policy`; budgets ratchet lower-stricter; scoped rule-file bytes drop vs pre-change `main`; fixture + real-tree proofs.

**Non-Goals:** `quality/review-checklist.md`; rewriting `opsx-*.md` beyond stripping Photobooks mandate duplicates; product UI; new deps; raising budgets above post-dedup sizes.

## Decisions

1. **Scoped rule-file set** — Budgets cover: `AGENTS.md`, every `.cursor/rules/*.mdc`, `.cursor/commands/next-roadmap-item.md`, every `.cursor/agents/*.md`, `openspec/config.yaml`. Exclude `opsx-*.md`.

2. **Owners** — OpenSpec mandates + quality bar → `openspec/config.yaml`; finish/PR → `git-finish.mdc`; verify/flake → `testing.mdc`; overview → `overview.mdc`; architecture → `architecture.mdc`; data model → `data-model.mdc`; unattended pipeline → `next-roadmap-item.md`; reviewer checklists → matching agent; module/command indexes → `AGENTS.md`.

3. **Dedup** — Shrink `AGENTS.md` Toolchain/Doc budget (drop verify/flake/finish/watch restatements; keep cli.json, agent-env, MCP, install/hooks, vite). Fold `agent-workflow.mdc` into `overview.mdc` as one pointer line (delete the file; alwaysApply count drops). Strip duplicate Photobooks mandates from agents/`next-roadmap-item` only where they restate the owner map.

4. **gates.json** — `agentRules.budgets` array of `{ path, maxLines, maxChars }` for every scoped path, set to measured post-dedup sizes. Missing path or missing budget entry → fail loud.

5. **Enforcement** — Absolute over-budget / missing path → `agent-rules-over-budget`; each maxLines/maxChars lower-stricter vs base → `gates-json-weaker`. New RULE_IDS/FIXTURE_IDS (superset). Small table-driven helpers; mutation ≥85% / 0 NoCoverage.

6. **Proofs** — Fixture CLI: over-budget red, within-budget green; unit test real scoped files within head budgets; record pre/post total bytes in Manual evidence.

7. **Specs** — Delta `ci-gates` + `agent-context`.

## Security

Detectors read head text as data only; no new dependencies.

## Touch-set

| Path                                                                  | Reason                      |
| --------------------------------------------------------------------- | --------------------------- |
| `quality/gates.json`                                                  | `agentRules.budgets`        |
| `scripts/check-gate-ratchet.mjs` (+ `.test.mjs`)                      | absolute + ratchet          |
| `AGENTS.md`, `.cursor/rules/*.mdc`                                    | dedup / fold agent-workflow |
| `.cursor/commands/next-roadmap-item.md`, `.cursor/agents/*.md`        | strip duplicates            |
| `openspec/config.yaml`                                                | pointer only if needed      |
| `openspec/specs/{ci-gates,agent-context}/spec.md`                     | archive sync                |
| `openspec/changes/rules-dedup/**`, `docs/roadmap/M2.1/rules-dedup.md` | planning / tick             |

## Risks / Trade-offs

- Cutting alwaysApply text may drop a needed habit → owner map + one-line pointers.
- `opsx-*` excluded from budgets → large wrappers remain (accepted for size).
- Budgets == measured size → any growth fails CI (intentional).

## Open Questions

N/A
